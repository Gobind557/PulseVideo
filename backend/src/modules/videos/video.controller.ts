import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import type { VideoService } from './video.service.js';
import type { listVideosQuerySchema } from './video.schemas.js';

function paramId(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value[0] !== undefined) {
    return value[0];
  }
  return '';
}

export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const q = req.query as unknown as z.infer<typeof listVideosQuerySchema>;
      const items = await this.videoService.listForOrg(user.organizationId, q);
      res.json(items);
    } catch (e) {
      next(e);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { originalFilename } = req.body as { originalFilename?: string };
      const doc = await this.videoService.createPending(
        user.organizationId,
        user.userId,
        originalFilename
      );
      res.status(201).json({ id: String(doc._id) });
    } catch (e) {
      next(e);
    }
  };

  presignedUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { originalFilename, contentType } = req.body as {
        originalFilename: string;
        contentType: string;
      };
      const result = await this.videoService.requestPresignedUpload(
        user.organizationId,
        user.userId,
        originalFilename,
        contentType
      );
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  };

  completeUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { videoId, storageKey } = req.body as { videoId: string; storageKey: string };
      await this.videoService.completePresignedUpload(
        user.organizationId,
        user.userId,
        videoId,
        storageKey
      );
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };

  presignedBlob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const videoId = paramId(req.params.videoId);
      const token = req.headers['x-upload-token'];
      const uploadToken = typeof token === 'string' ? token : undefined;
      const file = req.file;
      if (!file) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Missing file' });
        return;
      }
      await this.videoService.savePresignedBlob(
        user.organizationId,
        user.userId,
        videoId,
        uploadToken,
        file
      );
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };

  multerUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const id = paramId(req.params.id);
      const file = req.file;
      if (!file) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Missing file' });
        return;
      }
      const result = await this.videoService.saveMulterUpload(
        user.organizationId,
        user.userId,
        id,
        file
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const doc = await this.videoService.getById(user.organizationId, paramId(req.params.id));
      res.json(doc);
    } catch (e) {
      next(e);
    }
  };

  stream = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const payload = await this.videoService.getStreamPayload(
        user.organizationId,
        paramId(req.params.id),
        req.headers.range
      );
      res.status(payload.statusCode);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', payload.mimeType);
      if (payload.statusCode === 206) {
        res.setHeader('Content-Range', `bytes ${payload.start}-${payload.end}/${payload.total}`);
        res.setHeader('Content-Length', String(payload.end - payload.start + 1));
      } else {
        res.setHeader('Content-Length', String(payload.total));
      }
      payload.stream.on('error', next);
      payload.stream.pipe(res);
    } catch (e) {
      next(e);
    }
  };
}
