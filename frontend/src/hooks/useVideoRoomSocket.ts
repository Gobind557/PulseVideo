import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { pulseApi } from '@/lib/api/pulseApi';
import { getVideoSocket, disconnectVideoSocket } from '@/lib/socket/socket';

/**
 * Subscribes to video room after server verifies org ownership.
 * On terminal events, refetches server state instead of guessing cache shape.
 */
export function useVideoRoomSocket(
  videoId: string | undefined,
  onProgress?: (progress: number) => void,
  onStage?: (stage: string | undefined) => void
): void {
  const token = useAppSelector((s) => s.auth.accessToken);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!videoId || !token) {
      return;
    }

    const s = getVideoSocket(token);

    const onProgressEvt = (payload: { progress: number; stage?: string; videoId: string }) => {
      if (payload.videoId !== videoId) {
        return;
      }
      dispatch(
        pulseApi.util.updateQueryData('getVideo', videoId, (draft) => {
          draft.status = 'processing';
          draft.processingProgress = payload.progress;
          if (payload.stage) {
            draft.processingStage = payload.stage;
          }
        })
      );
      onProgress?.(payload.progress);
      onStage?.(payload.stage);
    };

    const invalidate = () => {
      dispatch(
        pulseApi.util.invalidateTags([
          { type: 'Video', id: videoId },
          { type: 'Video', id: 'LIST' },
        ])
      );
    };

    const onDone = (payload: { videoId: string }) => {
      if (payload.videoId === videoId) {
        invalidate();
      }
    };

    const onFail = (payload: { videoId: string; error: string }) => {
      if (payload.videoId === videoId) {
        dispatch(
          pulseApi.util.updateQueryData('getVideo', videoId, (draft) => {
            draft.status = 'failed';
            draft.processingError = payload.error;
          })
        );
        invalidate();
      }
    };

    s.on('processing_progress', onProgressEvt);
    s.on('processing_completed', onDone);
    s.on('processing_failed', onFail);

    s.emit('video:subscribe', videoId, (err?: Error) => {
      if (err) {
        console.warn('video subscribe failed', err);
      }
    });

    return () => {
      s.off('processing_progress', onProgressEvt);
      s.off('processing_completed', onDone);
      s.off('processing_failed', onFail);
    };
  }, [dispatch, onProgress, onStage, token, videoId]);
}

export function useDisconnectSocketOnLogout(isAuthed: boolean): void {
  useEffect(() => {
    if (!isAuthed) {
      disconnectVideoSocket();
    }
  }, [isAuthed]);
}
