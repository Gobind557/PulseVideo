import bcrypt from 'bcrypt';
import { loadEnvConfig } from '../config/env.js';
import { connectDb } from '../infrastructure/db/connect.js';
import { ensureUploadDir } from '../bootstrap/ensureUploadDir.js';
import { getStorageProvider } from '../infrastructure/storage/get-storage-provider.js';
import { OrgService } from '../modules/orgs/org.service.js';
import { UserModel } from '../infrastructure/db/models/user.model.js';
import { MembershipModel } from '../infrastructure/db/models/membership.model.js';
import { VideoModel } from '../infrastructure/db/models/video.model.js';
import { VideoAssignmentModel } from '../infrastructure/db/models/video-assignment.model.js';
import { makeVideoStorageKey } from '../infrastructure/storage/local-storage.provider.js';

const SALT_ROUNDS = 10;

async function upsertUser(email: string, password: string) {
  const existing = await UserModel.findOne({ email }).lean<{ _id: unknown } | null>();
  if (existing) {
    return String(existing._id);
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await UserModel.create({ email, passwordHash });
  return String(user._id);
}

async function main(): Promise<void> {
  const env = loadEnvConfig();
  await connectDb(env);
  const uploadRootAbs = ensureUploadDir(env);
  const storage = getStorageProvider(env, uploadRootAbs);

  const DEMO_PASSWORD = 'Pulse@12345';
  const adminEmail = 'admin@pulse.demo';
  const editorEmail = 'editor@pulse.demo';
  const viewerEmail = 'viewer@pulse.demo';

  const orgService = new OrgService();

  const adminUserId = await upsertUser(adminEmail, DEMO_PASSWORD);
  const { organizationId } = await orgService.createOrganizationWithAdmin(adminUserId, 'Pulse Demo Org');

  const editorUserId = await upsertUser(editorEmail, DEMO_PASSWORD);
  const viewerUserId = await upsertUser(viewerEmail, DEMO_PASSWORD);

  await MembershipModel.updateOne(
    { userId: editorUserId, organizationId },
    { $set: { userId: editorUserId, organizationId, role: 'editor' } },
    { upsert: true }
  );
  await MembershipModel.updateOne(
    { userId: viewerUserId, organizationId },
    { $set: { userId: viewerUserId, organizationId, role: 'viewer' } },
    { upsert: true }
  );

  const v1 = await VideoModel.create({
    organizationId,
    createdBy: adminUserId,
    status: 'completed',
    safetyStatus: 'safe',
    metadata: { originalFilename: 'admin-completed.webm', mimeType: 'video/webm', durationSec: 12 },
  });
  const v1Key = makeVideoStorageKey(String(v1._id), 'admin-completed.webm');
  await storage.saveBuffer(organizationId, v1Key, Buffer.from('demo video bytes - admin completed'));
  await VideoModel.updateOne({ _id: v1._id, organizationId }, { $set: { storagePath: v1Key } });

  const v2 = await VideoModel.create({
    organizationId,
    createdBy: editorUserId,
    status: 'failed',
    safetyStatus: 'unknown',
    processingError: 'Seeded failure for retry demo',
    metadata: { originalFilename: 'editor-failed.mp4', mimeType: 'video/mp4', durationSec: 40 },
  });

  const v3 = await VideoModel.create({
    organizationId,
    createdBy: editorUserId,
    status: 'processing',
    safetyStatus: 'pending_review',
    metadata: { originalFilename: 'editor-processing.mp4', mimeType: 'video/mp4', durationSec: 22 },
  });

  const v4 = await VideoModel.create({
    organizationId,
    createdBy: adminUserId,
    status: 'completed',
    safetyStatus: 'flagged',
    metadata: { originalFilename: 'flagged-completed.mp4', mimeType: 'video/mp4', durationSec: 8 },
  });
  const v4Key = makeVideoStorageKey(String(v4._id), 'flagged-completed.mp4');
  await storage.saveBuffer(organizationId, v4Key, Buffer.from('demo video bytes - flagged completed'));
  await VideoModel.updateOne({ _id: v4._id, organizationId }, { $set: { storagePath: v4Key } });

  await VideoAssignmentModel.updateOne(
    { organizationId, videoId: v1._id, userId: viewerUserId },
    { $set: { organizationId, videoId: v1._id, userId: viewerUserId, assignedBy: adminUserId } },
    { upsert: true }
  );
  await VideoAssignmentModel.updateOne(
    { organizationId, videoId: v4._id, userId: viewerUserId },
    { $set: { organizationId, videoId: v4._id, userId: viewerUserId, assignedBy: adminUserId } },
    { upsert: true }
  );

  console.log(
    JSON.stringify(
      {
        organizationId,
        password: DEMO_PASSWORD,
        users: {
          admin: adminEmail,
          editor: editorEmail,
          viewer: viewerEmail,
        },
        notes: {
          viewerAssignedVideos: [String(v1._id), String(v4._id)],
          editorOwnedVideos: [String(v2._id), String(v3._id)],
        },
      },
      null,
      2
    )
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});

