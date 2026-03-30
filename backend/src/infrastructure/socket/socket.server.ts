import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import type { Redis } from 'ioredis';
import type { Env } from '../../config/env.js';
import { VideoModel } from '../db/models/video.model.js';
import { VideoAssignmentModel } from '../db/models/video-assignment.model.js';
import type { MembershipRole } from '../db/models/membership.model.js';
import { VIDEO_EVENT_CHANNEL, type VideoSocketEvent } from './video-event-bus.js';
import { UnauthorizedError } from '../../shared/errors.js';

type JwtSocketPayload = {
  sub: string;
  org: string;
  role: MembershipRole;
  typ?: string;
};

/**
 * Socket.io authenticated with same access JWT; rooms are per-video after server validates org ownership.
 */
export function attachSocketServer(
  httpServer: HttpServer,
  env: Env,
  subscriber: Redis
): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        typeof socket.handshake.auth.token === 'string' ? socket.handshake.auth.token : undefined;
      if (!token) {
        throw new UnauthorizedError('Missing token');
      }
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtSocketPayload;
      if (decoded.typ != null && decoded.typ !== 'access') {
        throw new UnauthorizedError('Invalid token type');
      }
      socket.data.userId = decoded.sub;
      socket.data.organizationId = decoded.org;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('video:subscribe', async (videoId: string, cb?: (err?: Error) => void) => {
      try {
        const orgId = socket.data.organizationId as string;
        const role = socket.data.role as MembershipRole;
        const userId = socket.data.userId as string;
        const doc = await VideoModel.findOne({ _id: videoId, organizationId: orgId }).lean();
        if (!doc) {
          throw new Error('Video not found');
        }
        if (role === 'viewer') {
          const assignment = await VideoAssignmentModel.findOne({
            organizationId: orgId,
            videoId,
            userId,
          }).lean();
          if (!assignment) {
            throw new Error('Forbidden');
          }
        }
        await socket.join(`video:${videoId}`);
        cb?.();
      } catch (e) {
        cb?.(e instanceof Error ? e : new Error('subscribe failed'));
      }
    });
  });

  const sub = subscriber.duplicate();
  void sub.subscribe(VIDEO_EVENT_CHANNEL);
  sub.on('message', (_channel: string, message: string) => {
    try {
      const evt = JSON.parse(message) as VideoSocketEvent;
      const room = `video:${evt.videoId}`;
      if (evt.type === 'processing_progress') {
        io.to(room).emit('processing_progress', {
          progress: evt.progress,
          stage: evt.stage,
          videoId: evt.videoId,
        });
      } else if (evt.type === 'processing_completed') {
        io.to(room).emit('processing_completed', { videoId: evt.videoId, stage: evt.stage });
      } else if (evt.type === 'processing_failed') {
        io.to(room).emit('processing_failed', {
          videoId: evt.videoId,
          error: evt.error,
          stage: evt.stage,
        });
      }
    } catch {
      /* ignore malformed */
    }
  });

  return io;
}
