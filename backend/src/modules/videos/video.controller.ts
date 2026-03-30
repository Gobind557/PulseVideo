import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import type { VideoService } from './video.service.js';
import type { listVideosQuerySchema } from './video.schemas.js';
import { AppError } from '../../shared/errors.js';

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
      const items = await this.videoService.listForOrg(user.organizationId, q, {
        userId: user.userId,
        role: user.role,
      });
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
      if (!file.mimetype || !file.mimetype.startsWith('video/')) {
        throw new AppError('VALIDATION_ERROR', 'Only video uploads are allowed', 400, {
          mimeType: file.mimetype,
        });
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
      if (!file.mimetype || !file.mimetype.startsWith('video/')) {
        throw new AppError('VALIDATION_ERROR', 'Only video uploads are allowed', 400, {
          mimeType: file.mimetype,
        });
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
      const doc = await this.videoService.getById(user.organizationId, paramId(req.params.id), {
        userId: user.userId,
        role: user.role,
      });
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
        req.headers.range,
        { userId: user.userId, role: user.role }
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

  retry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const id = paramId(req.params.id);
      await this.videoService.retryProcessing({
        organizationId: user.organizationId,
        videoId: id,
        requesterUserId: user.userId,
        requesterRole: user.role,
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const id = paramId(req.params.id);
      const body = req.body as { originalFilename?: string };
      await this.videoService.updateVideo({
        organizationId: user.organizationId,
        videoId: id,
        requesterUserId: user.userId,
        requesterRole: user.role,
        patch: { originalFilename: body.originalFilename },
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const id = paramId(req.params.id);
      await this.videoService.deleteVideo({ organizationId: user.organizationId, videoId: id });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };

  listAssignees = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const id = paramId(req.params.id);
      const assignees = await this.videoService.listVideoAssignees({
        organizationId: user.organizationId,
        videoId: id,
      });
      res.json(assignees);
    } catch (e) {
      next(e);
    }
  };

  assignViewer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const id = paramId(req.params.id);
      const body = req.body as { userId: string };
      await this.videoService.assignViewerToVideo({
        organizationId: user.organizationId,
        videoId: id,
        viewerUserId: body.userId,
        assignedByUserId: user.userId,
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };

  unassignViewer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const id = paramId(req.params.id);
      const viewerUserId = paramId(req.params.userId);
      await this.videoService.unassignViewerFromVideo({
        organizationId: user.organizationId,
        videoId: id,
        viewerUserId,
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };
}
