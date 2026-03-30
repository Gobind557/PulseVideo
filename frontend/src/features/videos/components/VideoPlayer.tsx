import { useMemo, useState } from 'react';
import { useAppSelector } from '@/store/hooks';

type Props = {
  videoId: string;
};

/**
 * Uses native `<video src>` with a JWT in the query string so the browser can issue
 * Range requests for progressive streaming (no full-file blob download).
 */
export function VideoPlayer({ videoId }: Props) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const [err, setErr] = useState<string | null>(null);

  const src = useMemo(() => {
    if (!token) {
      return null;
    }
    const u = new URL(`/api/videos/${videoId}/stream`, window.location.origin);
    u.searchParams.set('access_token', token);
    return u.toString();
  }, [token, videoId]);

  if (!token) {
    return <p className="error">Sign in to play video</p>;
  }
  if (err) {
    return <p className="error">{err}</p>;
  }
  if (!src) {
    return <p>Loading player…</p>;
  }

  return (
    <video
      className="video-player"
      src={src}
      controls
      playsInline
      width="100%"
      onError={() => setErr('Could not load video stream')}
    />
  );
}
