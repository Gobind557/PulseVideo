import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useCreateVideoMutation,
  useListVideosQuery,
  useUploadVideoMulterMutation,
} from '@/lib/api/pulseApi';
import { RequireEditor } from '@/app/routes/ProtectedRoute';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { uploadFailed, uploadInitiated, uploadSucceeded } from '@/features/upload/uploadSlice';
import { registerAbort, releaseAbort } from '@/lib/upload/abortRegistry';

function DashboardContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? undefined;
  const minDurationSec = Number(searchParams.get('minDurationSec')) || undefined;
  const maxDurationSec = Number(searchParams.get('maxDurationSec')) || undefined;

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
  const [uploadMulter, { isLoading: uploading }] = useUploadVideoMulterMutation();
  const role = useAppSelector((s) => s.auth.role);
  const dispatch = useAppDispatch();
  const fileRef = useRef<HTMLInputElement>(null);

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

  const canEdit = role === 'editor' || role === 'admin';
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onUploadPick = async () => {
    const input = fileRef.current;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }
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
      if (input) {
        input.value = '';
      }
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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Pulse</h1>
        {canEdit && (
          <RequireEditor>
            <div className="upload-row">
              <input ref={fileRef} type="file" accept="video/*" />
              <button
                type="button"
                disabled={creating || uploading}
                onClick={() => void onUploadPick()}
              >
                {creating || uploading ? 'Uploading…' : 'Create and upload'}
              </button>
            </div>
          </RequireEditor>
        )}
      </header>
      {uploadError && <p className="error">{uploadError}</p>}

      <section className="filters">
        <label>
          Status
          <select
            value={status ?? ''}
            onChange={(ev) => setFilter('status', ev.target.value)}
          >
            <option value="">Any</option>
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <label>
          Min duration (s)
          <input
            type="number"
            min={0}
            value={searchParams.get('minDurationSec') ?? ''}
            onChange={(ev) => setFilter('minDurationSec', ev.target.value)}
          />
        </label>
        <label>
          Max duration (s)
          <input
            type="number"
            min={0}
            value={searchParams.get('maxDurationSec') ?? ''}
            onChange={(ev) => setFilter('maxDurationSec', ev.target.value)}
          />
        </label>
      </section>

      {isFetching && <p>Refreshing…</p>}
      <ul className="video-list">
        {videos?.map((v) => (
          <li key={v._id}>
            <Link to={`/videos/${v._id}`}>
              {v.metadata?.originalFilename ?? v._id}
            </Link>
            <span className="meta">
              {v.status} {v.safetyStatus && ` / ${v.safetyStatus}`}
              {v.metadata?.durationSec != null &&
                ` / ${v.metadata.durationSec.toFixed(1)}s`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
