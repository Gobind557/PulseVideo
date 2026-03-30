import { Router } from 'express';
import multer from 'multer';
import type { Env } from '../../config/env.js';
import { authenticateJWT } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { VideoController } from './video.controller.js';
import type { VideoService } from './video.service.js';
import {
  completeUploadBodySchema,
  createVideoBodySchema,
  listVideosQuerySchema,
  presignedUploadBodySchema,
} from './video.schemas.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

export function createVideoRouter(env: Env, videoService: VideoService): Router {
  const router = Router();
  const auth = authenticateJWT(env);
  const ctrl = new VideoController(videoService);

  router.use(auth);

  router.get('/', requireRole('viewer'), validateQuery(listVideosQuerySchema), ctrl.list);
  router.post('/', requireRole('editor'), validateBody(createVideoBodySchema), ctrl.create);
  router.post(
    '/presigned-upload',
    requireRole('editor'),
    validateBody(presignedUploadBodySchema),
    ctrl.presignedUpload
  );
  router.post(
    '/complete-upload',
    requireRole('editor'),
    validateBody(completeUploadBodySchema),
    ctrl.completeUpload
  );
  router.post(
    '/presigned-blob/:videoId',
    requireRole('editor'),
    upload.single('file'),
    ctrl.presignedBlob
  );
  router.get('/:id/stream', requireRole('viewer'), ctrl.stream);
  router.post('/:id/upload', requireRole('editor'), upload.single('file'), ctrl.multerUpload);
  router.post('/:id/retry', requireRole('editor'), ctrl.retry);
  router.get('/:id', requireRole('viewer'), ctrl.get);

  return router;
}
