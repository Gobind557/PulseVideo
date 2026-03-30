import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useCreateVideoMutation,
  useListVideosQuery,
  useRetryVideoMutation,
  useUploadVideoMulterMutation,
} from '@/lib/api/pulseApi';
import { useRBAC } from '@/hooks/useRBAC';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  uploadFailed,
  uploadInitiated,
  uploadSucceeded,
} from '@/features/upload/uploadSlice';
import { registerAbort, releaseAbort } from '@/lib/upload/abortRegistry';

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

  const { data: videos, isFetching } = useListVideosQuery(queryArgs);
  const [createVideo, { isLoading: creating }] = useCreateVideoMutation();
  const [retryVideo] = useRetryVideoMutation();
  const [uploadMulter, { isLoading: uploading }] =
    useUploadVideoMulterMutation();

  const { role, canUpload, canDelete } = useRBAC();
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.accessToken);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
      if (videoId) {
        dispatch(
          uploadFailed({
            videoId,
            error: e instanceof Error ? e.message : 'Upload failed',
          })
        );
        releaseAbort(videoId);
      } else {
        setUploadError('Could not create video record');
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

  const tabCounts = useMemo(() => {
    const all = filteredVideos.length;
    const completed = filteredVideos.filter((v) => v.status === 'completed').length;
    const processing = filteredVideos.filter((v) => v.status === 'processing').length;
    const failed = filteredVideos.filter((v) => v.status === 'failed').length;
    return { all, completed, processing, failed };
  }, [filteredVideos]);

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
              <div className="upload-dropzone-icon" />
              <div className="upload-dropzone-title">Upload a New Video</div>
              <div className="upload-dropzone-subtitle">
                Drag and drop or click to select your file
              </div>
              <div className="upload-dropzone-meta">Max size: 500MB · MP4 · More info</div>
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
            <div className="hero-preview" />
          </section>
        ) : null}

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
                {filteredVideos.map((v) => {
                  const isOwn = currentUserId != null && currentUserId === v.createdBy;
                  const canEditOwn = role === 'editor' && isOwn;
                  const canEditAsAdmin = role === 'admin';
                  const canEditRow = canEditAsAdmin || canEditOwn;
                  const progress =
                    v.status === 'completed' ? 100 : v.status === 'processing' ? 55 : 0;
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
                          <div className="progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="progress-text">{progress}%</div>
                      </td>
                      <td>{new Date(v.updatedAt).toLocaleString()}</td>
                      <td>
                        <div className="actions">
                          <Link className="btn btn-secondary btn-sm" to={`/videos/${v._id}`}>
                            View
                          </Link>
                          {canEditRow ? (
                            <Link className="btn btn-secondary btn-sm" to={`/videos/${v._id}`}>
                              Edit
                            </Link>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              className="danger btn-sm"
                              onClick={() => window.alert('Delete endpoint will be wired next step.')}
                            >
                              Delete
                            </button>
                          ) : null}
                          {v.status === 'failed' && (role === 'admin' || role === 'editor') ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => void retryVideo({ videoId: v._id })}
                            >
                              Retry
                            </button>
                          ) : null}
                        </div>
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
