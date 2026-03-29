/** AbortControllers live outside the Redux store (non-serializable). */

const controllers = new Map<string, AbortController>();

export function registerAbort(videoId: string): AbortController {
  abortUpload(videoId);
  const c = new AbortController();
  controllers.set(videoId, c);
  return c;
}

export function abortUpload(videoId: string): void {
  const c = controllers.get(videoId);
  if (c) {
    c.abort();
    controllers.delete(videoId);
  }
}

export function releaseAbort(videoId: string): void {
  controllers.delete(videoId);
}
