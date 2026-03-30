import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRetryVideoMutation } from '@/lib/api/pulseApi';
import type { VideoDto, VideoStatus } from '@/types/video';
import { useAppSelector } from '@/store/hooks';
import { useVideoRoomSocket } from '@/hooks/useVideoRoomSocket';

type Props = {
  video: VideoDto;
};

function statusToTheme(status: VideoStatus) {
  if (status === 'completed') return 'card-completed';
  if (status === 'processing') return 'card-processing';
  if (status === 'failed') return 'card-failed';
  return 'card-pending';
}

export function VideoCard({ video }: Props) {
  const role = useAppSelector((s) => s.auth.role);
  const canRetry = role === 'editor' || role === 'admin';

  const [progress, setProgress] = useState<number | null>(null);
  useVideoRoomSocket(video.status === 'processing' ? video._id : undefined, setProgress);

  const [retryVideo, { isLoading: isRetrying }] = useRetryVideoMutation();

  const themeClass = useMemo(() => statusToTheme(video.status), [video.status]);
  const showProgress = video.status === 'processing' && progress != null;

  return (
    <li className={`video-card ${themeClass}`}>
      <div className="video-card-top">
        <div className="status-pill">
          {video.status === 'completed' ? 'Completed' : null}
          {video.status === 'processing' ? 'Processing' : null}
          {video.status === 'failed' ? 'Failed' : null}
          {video.status === 'pending' ? 'Pending' : null}
        </div>

        {video.status === 'processing' && showProgress ? (
          <div className="progress-label">{progress}%</div>
        ) : null}
      </div>

      {showProgress ? (
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <div className="video-card-name">
        {video.metadata?.originalFilename ?? video._id}
      </div>

      <div className="video-card-meta">
        <div>
          Status: <strong>{video.status}</strong>
        </div>
        {video.safetyStatus ? (
          <div>
            Safety: <strong>{video.safetyStatus}</strong>
          </div>
        ) : null}
        {video.metadata?.durationSec != null ? (
          <div>
            Duration: <strong>{video.metadata.durationSec.toFixed(1)}s</strong>
          </div>
        ) : null}
      </div>

      {video.processingError ? (
        <div className="error-inline">Error: {video.processingError}</div>
      ) : null}

      <div className="video-card-actions">
        <Link className="btn btn-primary" to={`/videos/${video._id}`}>
          View
        </Link>

        {video.status === 'failed' ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!canRetry || isRetrying}
            onClick={() => void retryVideo({ videoId: video._id })}
          >
            {isRetrying ? 'Retrying…' : 'Retry'}
          </button>
        ) : null}
      </div>
    </li>
  );
}

