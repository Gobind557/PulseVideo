import { useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks';

type Props = {
  videoId: string;
};

/**
 * Fetches full stream with Authorization. Fine for dev / small files;
 * production usually uses short-lived URLs or HLS.
 */
export function VideoPlayer({ videoId }: Props) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let objectUrl: string | null = null;
    const ac = new AbortController();
    const run = async () => {
      try {
        setErr(null);
        const res = await fetch(`/api/videos/${videoId}/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ac.signal,
        });
        if (!res.ok) {
          setErr(`Stream failed (${res.status})`);
          return;
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          return;
        }
        setErr('Could not load video');
      }
    };
    void run();
    return () => {
      ac.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [token, videoId]);

  if (err) {
    return <p className="error">{err}</p>;
  }
  if (!src) {
    return <p>Loading player…</p>;
  }

  return <video className="video-player" src={src} controls playsInline width="100%" />;
}
