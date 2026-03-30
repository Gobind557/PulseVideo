import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGetVideoQuery } from '@/lib/api/pulseApi';
import { useVideoRoomSocket } from '@/hooks/useVideoRoomSocket';
import { VideoPlayer } from '@/features/videos/components/VideoPlayer';

export default function VideoDetailPage() {
  const { id } = useParams();
  const videoId = id ?? '';
  const { data, isLoading, error } = useGetVideoQuery(videoId, {
    skip: !videoId,
  });
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState<string | undefined>(undefined);

  useVideoRoomSocket(videoId || undefined, setProgress, setStage);

  if (!videoId) {
    return <p>Missing video id</p>;
  }
  if (isLoading) {
    return <p>Loading…</p>;
  }
  if (error || !data) {
    return (
      <p className="error">
        Could not load video.{' '}
        <Link to="/dashboard">Back</Link>
      </p>
    );
  }

  const showPlayer = data.status === 'completed' && data.storagePath;

  return (
    <div className="video-detail">
      <header>
        <Link to="/dashboard">Dashboard</Link>
        <h1>{data.metadata?.originalFilename ?? data._id}</h1>
      </header>
      <p className="meta-line">
        Status: <strong>{data.status}</strong>
        {data.safetyStatus && (
          <>
            {' '}
            Safety: <strong>{data.safetyStatus}</strong>
          </>
        )}
        {progress != null && data.status === 'processing' && (
          <>
            {' '}
            Progress: {progress}%
            {stage ? <> · Stage: {stage}</> : null}
          </>
        )}
      </p>
      {data.processingError && (
        <p className="error">Error: {data.processingError}</p>
      )}
      <section className="meta-grid">
        <div>
          Duration: {data.metadata?.durationSec?.toFixed(2) ?? '—'}s
        </div>
        <div>
          Resolution:{' '}
          {data.metadata?.width && data.metadata?.height
            ? `${data.metadata.width}x${data.metadata.height}`
            : '—'}
        </div>
        <div>MIME: {data.metadata?.mimeType ?? '—'}</div>
      </section>
      {showPlayer ? (
        <VideoPlayer videoId={videoId} />
      ) : (
        <p className="hint">Player available when processing completes.</p>
      )}
    </div>
  );
}
