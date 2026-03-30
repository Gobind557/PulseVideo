import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCreateVideoMutation,
  useListVideosQuery,
  useRetryVideoMutation,
  useUploadVideoMulterMutation,
} from '@/lib/api/pulseApi';
import { AdminActions, EditorActions, ViewerActions } from '@/features/videos/components/VideoActions';
import { useRBAC } from '@/hooks/useRBAC';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  uploadFailed,
  uploadInitiated,
  uploadSucceeded,
} from '@/features/upload/uploadSlice';
import { registerAbort, releaseAbort } from '@/lib/upload/abortRegistry';
import type { VideoDto } from '@/types/video';
import { getVideoSocket } from '@/lib/socket/socket';
import { getRtkQueryErrorMessage } from '@/lib/api/rtkErrorMessage';

function DashboardContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? undefined;

  const minDurationSecRaw = searchParams.get('minDurationSec');
  const maxDurationSecRaw = searchParams.get('maxDurationSec');
  const minDurationSec =
    minDurationSecRaw != null && minDurationSecRaw !== ''
      ? Number(minDurationSecRaw)
      : undefined;
  const maxDurationSec =
    maxDurationSecRaw != null && maxDurationSecRaw !== ''
      ? Number(maxDurationSecRaw)
      : undefined;

  const queryArgs = useMemo(
    () => ({
      ...(status ? { status } : {}),
      ...(minDurationSec != null ? { minDurationSec } : {}),
      ...(maxDurationSec != null ? { maxDurationSec } : {}),
    }),
    [status, minDurationSec, maxDurationSec]
  );

  const { data: videos, isFetching, refetch } = useListVideosQuery(queryArgs);
  const [createVideo, { isLoading: creating }] = useCreateVideoMutation();
  const [retryVideo] = useRetryVideoMutation();
  const [uploadMulter, { isLoading: uploading }] =
    useUploadVideoMulterMutation();

  const { role, canUpload } = useRBAC();
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.accessToken);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([]);
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [hiddenVideoIds, setHiddenVideoIds] = useState<Record<string, true>>({});

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const uploadFile = async (file: File) => {
    setUploadError(null);
    let videoId = '';
    try {
      const created = await createVideo({
        originalFilename: file.name,
      }).unwrap();
      videoId = created.id;
      const ac = registerAbort(videoId);
      dispatch(uploadInitiated({ videoId, fileName: file.name }));
      await uploadMulter({
        videoId,
        file,
        signal: ac.signal,
      }).unwrap();
      dispatch(uploadSucceeded({ videoId }));
      releaseAbort(videoId);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      const message = getRtkQueryErrorMessage(
        e,
        videoId ? 'Upload failed' : 'Could not create video record'
      );
      if (videoId) {
        dispatch(
          uploadFailed({
            videoId,
            error: message,
          })
        );
        setUploadError(message);
        releaseAbort(videoId);
      } else {
        setUploadError(message);
      }
    }
  };

  const currentUserId = useMemo(() => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]!)) as { sub?: string };
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }, [token]);

  const filteredVideos = useMemo(() => videos ?? [], [videos]);
  const visibleVideos = useMemo(
    () =>
      filteredVideos
        .filter((v) => !hiddenVideoIds[v._id])
        .map((v) => ({
          ...v,
          metadata: {
            ...v.metadata,
            ...(nameOverrides[v._id] ? { originalFilename: nameOverrides[v._id] } : {}),
          },
        })),
    [filteredVideos, hiddenVideoIds, nameOverrides]
  );

  const [liveProgress, setLiveProgress] = useState<Record<string, number>>({});
  const [liveStage, setLiveStage] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!token) return;
    const processingIds = visibleVideos.filter((v) => v.status === 'processing').map((v) => v._id);
    if (processingIds.length === 0) return;

    const s = getVideoSocket(token);
    const onProgressEvt = (payload: { progress: number; stage?: string; videoId: string }) => {
      setLiveProgress((prev) => ({ ...prev, [payload.videoId]: payload.progress }));
      if (payload.stage) {
        setLiveStage((prev) => ({ ...prev, [payload.videoId]: payload.stage! }));
      }
    };
    const onDone = (payload: { videoId: string }) => {
      setLiveProgress((prev) => ({ ...prev, [payload.videoId]: 100 }));
      setLiveStage((prev) => ({ ...prev, [payload.videoId]: 'completed' }));
      refetch();
    };
    const onFail = (payload: { videoId: string }) => {
      setLiveProgress((prev) => {
        const copy = { ...prev };
        delete copy[payload.videoId];
        return copy;
      });
      setLiveStage((prev) => {
        const copy = { ...prev };
        delete copy[payload.videoId];
        return copy;
      });
      refetch();
    };
    s.on('processing_progress', onProgressEvt);
    s.on('processing_completed', onDone);
    s.on('processing_failed', onFail);
    for (const id of processingIds) {
      s.emit('video:subscribe', id);
    }
    return () => {
      s.off('processing_progress', onProgressEvt);
      s.off('processing_completed', onDone);
      s.off('processing_failed', onFail);
    };
  }, [refetch, token, visibleVideos]);

  const tabCounts = useMemo(() => {
    const all = visibleVideos.length;
    const completed = visibleVideos.filter((v) => v.status === 'completed').length;
    const processing = visibleVideos.filter((v) => v.status === 'processing').length;
    const failed = visibleVideos.filter((v) => v.status === 'failed').length;
    return { all, completed, processing, failed };
  }, [visibleVideos]);

  const pushToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2400);
  }, []);

  const retryWithFeedback = async (video: VideoDto) => {
    try {
      await retryVideo({ videoId: video._id }).unwrap();
      pushToast('Retry queued', 'success');
    } catch {
      pushToast('Retry failed', 'error');
    }
  };

  const activeTab = status ?? 'all';

  return (
    <div className="dashboard-shell">
      <div className="dashboard-container">
        <h1 className="page-title">Dashboard</h1>
        <div className="welcome-title">
          Welcome back, {role === 'admin' ? 'Admin' : role === 'editor' ? 'Editor' : 'Viewer'}.
        </div>

        {canUpload ? (
          <section className="upload-hero">
            <div
              className={`upload-dropzone ${
                isDragging ? 'upload-dropzone-drag' : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void uploadFile(f);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(ev) => {
                  const f = ev.currentTarget.files?.[0];
                  if (f) void uploadFile(f);
                }}
              />
              <div className="upload-dropzone-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path d="M12 16V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 17.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="upload-dropzone-title">Upload a New Video</div>
              <div className="upload-dropzone-subtitle">
                Drag and drop or click to select your file
              </div>
              <div className="upload-dropzone-meta">
                Max size and allowed formats follow your org settings (System Settings).
              </div>
              <button
                type="button"
                className="btn btn-primary upload-dropzone-btn"
                disabled={creating || uploading}
                onClick={() => void fileRef.current?.click()}
              >
                {creating || uploading ? 'Uploading…' : 'Upload Video'}
              </button>
              {uploadError ? <p className="error">{uploadError}</p> : null}
            </div>
            <div className="hero-preview">
              <h3>Queue Snapshot</h3>
              <div className="hero-preview-grid">
                <div>
                  <span>Processing</span>
                  <strong>{tabCounts.processing}</strong>
                </div>
                <div>
                  <span>Completed</span>
                  <strong>{tabCounts.completed}</strong>
                </div>
                <div>
                  <span>Flagged</span>
                  <strong>{tabCounts.failed}</strong>
                </div>
              </div>
              <p>Live overview of current pipeline health.</p>
            </div>
          </section>
        ) : null}
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>

        <section className="table-panel">
          <div className="table-panel-toolbar">
            <div className="status-tabs">
              <button
                type="button"
                className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('status', '')}
              >
                All <span>{tabCounts.all}</span>
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
                onClick={() => setFilter('status', 'completed')}
              >
                Completed <span>{tabCounts.completed}</span>
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'processing' ? 'active' : ''}`}
                onClick={() => setFilter('status', 'processing')}
              >
                Processing <span>{tabCounts.processing}</span>
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'failed' ? 'active' : ''}`}
                onClick={() => setFilter('status', 'failed')}
              >
                Flagged <span>{tabCounts.failed}</span>
              </button>
            </div>

            <div className="toolbar-filters">
              <label className="filters-label compact">
                <span>Min</span>
                <input
                  type="number"
                  min={0}
                  value={searchParams.get('minDurationSec') ?? ''}
                  onChange={(ev) => setFilter('minDurationSec', ev.target.value)}
                />
              </label>
              <label className="filters-label compact">
                <span>Max</span>
                <input
                  type="number"
                  min={0}
                  value={searchParams.get('maxDurationSec') ?? ''}
                  onChange={(ev) => setFilter('maxDurationSec', ev.target.value)}
                />
              </label>
            </div>
          </div>

          {isFetching ? <div className="loading-inline">Refreshing…</div> : null}

          <div className="video-table-wrap">
            <table className="video-table">
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Uploader</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleVideos.map((v) => {
                  const isOwn = currentUserId != null && currentUserId === v.createdBy;
                  const canEditOwn = role === 'editor' && isOwn;
                  const canEditAsAdmin = role === 'admin';
                  const canEditRow = canEditAsAdmin || canEditOwn;
                  const progress =
                    v.status === 'completed'
                      ? 100
                      : v.status === 'failed'
                        ? 0
                        : liveProgress[v._id] ?? v.processingProgress ?? null;
                  const stage =
                    v.status === 'processing'
                      ? liveStage[v._id] ?? v.processingStage ?? 'processing'
                      : v.status;
                  return (
                    <tr key={v._id}>
                      <td>
                        <div className="cell-title">{v.metadata.originalFilename ?? v._id}</div>
                        <div className="cell-sub">{new Date(v.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td>
                        <div className="uploader-chip">@{v.createdBy.slice(-8)}</div>
                      </td>
                      <td>
                        <span className={`status-chip status-${v.status}`}>{v.status}</span>
                      </td>
                      <td>
                        <div className="progress-track">
                          {progress == null ? (
                            <div className="progress-fill progress-fill-indeterminate" />
                          ) : (
                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                          )}
                        </div>
                        <div className="progress-text">
                          {progress == null ? 'Processing…' : `${progress}%`}
                          {stage && v.status === 'processing' ? ` · ${stage}` : ''}
                        </div>
                      </td>
                      <td>{new Date(v.updatedAt).toLocaleString()}</td>
                      <td>
                        {role === 'admin' ? (
                          <div className="actions">
                            <AdminActions
                              video={v}
                              canEdit={canEditRow}
                              onToast={pushToast}
                              onRenameOptimistic={(videoId, nextName) =>
                                setNameOverrides((prev) => ({ ...prev, [videoId]: nextName }))
                              }
                              onRenameRollback={(videoId) =>
                                setNameOverrides((prev) => {
                                  const copy = { ...prev };
                                  delete copy[videoId];
                                  return copy;
                                })
                              }
                              onDeleteOptimistic={(videoId) =>
                                setHiddenVideoIds((prev) => ({ ...prev, [videoId]: true }))
                              }
                              onDeleteRollback={(videoId) =>
                                setHiddenVideoIds((prev) => {
                                  const copy = { ...prev };
                                  delete copy[videoId];
                                  return copy;
                                })
                              }
                            />
                            {v.status === 'failed' ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => void retryWithFeedback(v)}
                              >
                                Retry
                              </button>
                            ) : null}
                          </div>
                        ) : role === 'editor' ? (
                          <div className="actions">
                            <EditorActions
                              video={v}
                              canEdit={canEditRow}
                              onToast={pushToast}
                              onRenameOptimistic={(videoId, nextName) =>
                                setNameOverrides((prev) => ({ ...prev, [videoId]: nextName }))
                              }
                              onRenameRollback={(videoId) =>
                                setNameOverrides((prev) => {
                                  const copy = { ...prev };
                                  delete copy[videoId];
                                  return copy;
                                })
                              }
                            />
                            {v.status === 'failed' ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => void retryWithFeedback(v)}
                              >
                                Retry
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <ViewerActions video={v} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
