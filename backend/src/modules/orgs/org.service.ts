import mongoose from 'mongoose';
import {
  MembershipModel,
  type MembershipLean,
  type MembershipRole,
} from '../../infrastructure/db/models/membership.model.js';
import {
  DEFAULT_ORG_SETTINGS,
  OrganizationModel,
  type OrgSettings,
} from '../../infrastructure/db/models/organization.model.js';
import { RefreshTokenModel } from '../../infrastructure/db/models/refresh-token.model.js';
import { UserModel } from '../../infrastructure/db/models/user.model.js';
import { OrgInviteModel } from '../../infrastructure/db/models/org-invite.model.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js';
import crypto from 'node:crypto';

/**
 * Membership is the tenant boundary: all org-scoped operations validate via this service.
 */
export class OrgService {
  private assertOrgMatch(requesterOrganizationId: string, orgIdParam: string): void {
    if (requesterOrganizationId !== orgIdParam) {
      throw new ForbiddenError('Organization mismatch');
    }
  }

  async assertMembership(userId: string, organizationId: string): Promise<MembershipRole> {
    const m = await MembershipModel.findOne({ userId, organizationId }).lean<MembershipLean | null>();
    if (!m) {
      throw new ForbiddenError('Not a member of this organization');
    }
    return m.role;
  }

  async getMembershipOrThrow(userId: string, organizationId: string) {
    const m = await MembershipModel.findOne({ userId, organizationId }).lean<MembershipLean | null>();
    if (!m) {
      throw new NotFoundError('Membership not found');
    }
    return m;
  }

  async createOrganizationWithAdmin(userId: string, name: string) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const [org] = await OrganizationModel.create([{ name }], { session });
      await MembershipModel.create(
        [
          {
            userId,
            organizationId: org._id,
            role: 'admin',
          },
        ],
        { session }
      );
      await session.commitTransaction();
      return { organizationId: String(org._id), role: 'admin' as const };
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  }

  async listMemberships(userId: string) {
    return MembershipModel.find({ userId }).populate('organizationId').lean();
  }

  async listOrgMembers(args: {
    requesterUserId: string;
    requesterOrganizationId: string;
    orgIdParam: string;
  }): Promise<Array<{ userId: string; email: string; role: MembershipRole }>> {
    const { requesterOrganizationId, orgIdParam } = args;
    this.assertOrgMatch(requesterOrganizationId, orgIdParam);

    const memberships = await MembershipModel.find({ organizationId: requesterOrganizationId })
      .select({ userId: 1, role: 1 })
      .lean<Array<{ userId: mongoose.Types.ObjectId; role: MembershipRole }>>();

    const userIds = memberships.map((m) => String(m.userId));
    const users = await UserModel.find({ _id: { $in: userIds } })
      .select({ email: 1 })
      .lean<Array<{ _id: mongoose.Types.ObjectId; email: string }>>();
    const userById = new Map(users.map((u) => [String(u._id), u.email]));

    return memberships.map((m) => {
      const email = userById.get(String(m.userId));
      if (!email) {
        throw new NotFoundError('User not found for membership');
      }
      return {
        userId: String(m.userId),
        email,
        role: m.role,
      };
    });
  }

  async changeMemberRole(args: {
    requesterUserId: string;
    requesterOrganizationId: string;
    orgIdParam: string;
    memberUserId: string;
    role: MembershipRole;
  }): Promise<void> {
    const { requesterUserId, requesterOrganizationId, orgIdParam, memberUserId, role } = args;
    this.assertOrgMatch(requesterOrganizationId, orgIdParam);

    const member = await MembershipModel.findOne({
      userId: memberUserId,
      organizationId: requesterOrganizationId,
    }).lean<MembershipLean | null>();
    if (!member) {
      throw new NotFoundError('Membership not found');
    }

    // Prevent leaving the org without an admin.
    if (member.role === 'admin' && role !== 'admin') {
      const otherAdmins = await MembershipModel.countDocuments({
        organizationId: requesterOrganizationId,
        role: 'admin',
        userId: { $ne: memberUserId },
      });
      if (otherAdmins === 0) {
        throw new ForbiddenError('Cannot remove the last admin');
      }
    }

    await MembershipModel.updateOne(
      { userId: memberUserId, organizationId: requesterOrganizationId },
      { $set: { role } }
    );

    // If the admin changed their own role, revoke refresh tokens to force a re-auth.
    // (Otherwise the current JWT would keep the old role until expiry/refresh.)
    if (memberUserId === requesterUserId) {
      await RefreshTokenModel.updateMany(
        { userId: requesterUserId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
  }

  async removeOrgMember(args: {
    requesterUserId: string;
    requesterOrganizationId: string;
    orgIdParam: string;
    memberUserId: string;
  }): Promise<void> {
    const { requesterUserId, requesterOrganizationId, orgIdParam, memberUserId } = args;
    this.assertOrgMatch(requesterOrganizationId, orgIdParam);

    if (memberUserId === requesterUserId) {
      throw new ForbiddenError('Cannot remove yourself');
    }

    const member = await MembershipModel.findOne({
      userId: memberUserId,
      organizationId: requesterOrganizationId,
    }).lean<MembershipLean | null>();
    if (!member) {
      throw new NotFoundError('Membership not found');
    }

    if (member.role === 'admin') {
      const otherAdmins = await MembershipModel.countDocuments({
        organizationId: requesterOrganizationId,
        role: 'admin',
        userId: { $ne: memberUserId },
      });
      if (otherAdmins === 0) {
        throw new ForbiddenError('Cannot remove the last admin');
      }
    }

    await MembershipModel.deleteOne({
      userId: memberUserId,
      organizationId: requesterOrganizationId,
    });

    // Kick the removed user so they cannot keep refreshing old JWTs.
    await RefreshTokenModel.updateMany(
      { userId: memberUserId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }

  async createOrgInvite(args: {
    requesterUserId: string;
    requesterOrganizationId: string;
    orgIdParam: string;
    email?: string;
    role?: MembershipRole;
  }): Promise<{ inviteToken: string; expiresAt: string; organizationId: string; role: MembershipRole; email?: string }> {
    const { requesterUserId, requesterOrganizationId, orgIdParam, email, role } = args;
    this.assertOrgMatch(requesterOrganizationId, orgIdParam);

    const settings = await this.getOrgSettingsById(requesterOrganizationId);
    const resolvedRole = role ?? settings.defaultRoleForNewUsers;

    const inviteToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

    await OrgInviteModel.create({
      organizationId: requesterOrganizationId,
      email: email ?? null,
      role: resolvedRole,
      tokenHash,
      expiresAt,
      createdBy: requesterUserId,
      usedAt: null,
    });

    return {
      inviteToken,
      expiresAt: expiresAt.toISOString(),
      organizationId: requesterOrganizationId,
      role: resolvedRole,
      ...(email ? { email } : {}),
    };
  }

  async consumeOrgInvite(args: {
    inviteToken: string;
    email: string;
    userId: string;
  }): Promise<{ organizationId: string; role: MembershipRole }> {
    const { inviteToken, email, userId } = args;
    const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
    const invite = await OrgInviteModel.findOne({ tokenHash }).lean<{
      _id: mongoose.Types.ObjectId;
      organizationId: mongoose.Types.ObjectId;
      email?: string | null;
      role: MembershipRole;
      expiresAt: Date;
      usedAt?: Date | null;
    } | null>();
    if (!invite) {
      throw new NotFoundError('Invite not found');
    }
    if (invite.usedAt) {
      throw new ForbiddenError('Invite already used');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenError('Invite expired');
    }
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      throw new ForbiddenError('Invite email mismatch');
    }

    const organizationId = String(invite.organizationId);
    const existing = await MembershipModel.findOne({ userId, organizationId }).lean<MembershipLean | null>();
    if (existing) {
      throw new ConflictError('User is already a member of this organization');
    }

    // Ensure invite is single-use even under races: mark used then create membership.
    const used = await OrgInviteModel.updateOne(
      { _id: invite._id, usedAt: null },
      { $set: { usedAt: new Date() } }
    );
    if (used.modifiedCount !== 1) {
      throw new AppError('CONFLICT', 'Invite already used', 409);
    }

    await MembershipModel.create({
      userId,
      organizationId,
      role: invite.role,
    });

    return { organizationId, role: invite.role };
  }

  async getOrgSettings(args: {
    requesterOrganizationId: string;
    orgIdParam: string;
  }): Promise<{ name: string } & OrgSettings> {
    const { requesterOrganizationId, orgIdParam } = args;
    this.assertOrgMatch(requesterOrganizationId, orgIdParam);
    const org = await OrganizationModel.findById(orgIdParam).lean<{
      name: string;
      settings?: Partial<OrgSettings> | null;
    } | null>();
    if (!org) {
      throw new NotFoundError('Organization not found');
    }
    const s = org.settings ?? {};
    return {
      name: org.name,
      ...DEFAULT_ORG_SETTINGS,
      ...s,
    };
  }

  async updateOrgSettings(args: {
    requesterOrganizationId: string;
    orgIdParam: string;
    patch: Partial<OrgSettings> & { name?: string };
  }): Promise<{ name: string } & OrgSettings> {
    const { requesterOrganizationId, orgIdParam, patch } = args;
    this.assertOrgMatch(requesterOrganizationId, orgIdParam);

    const setDoc: Record<string, unknown> = {};
    if (patch.name != null && patch.name.trim() !== '') {
      setDoc.name = patch.name.trim();
    }
    const settingsKeys: (keyof OrgSettings)[] = [
      'defaultRoleForNewUsers',
      'maxVideoFileSizeMb',
      'allowedFormats',
      'sensitivityLevel',
      'automaticProcessing',
    ];
    for (const k of settingsKeys) {
      const v = patch[k];
      if (v !== undefined) {
        setDoc[`settings.${k}`] = v;
      }
    }

    if (Object.keys(setDoc).length === 0) {
      return this.getOrgSettings({ requesterOrganizationId, orgIdParam });
    }

    const updated = await OrganizationModel.findByIdAndUpdate(
      orgIdParam,
      { $set: setDoc },
      { new: true, runValidators: true }
    ).lean<{ name: string; settings?: Partial<OrgSettings> | null } | null>();

    if (!updated) {
      throw new NotFoundError('Organization not found');
    }
    const s = updated.settings ?? {};
    return {
      name: updated.name,
      ...DEFAULT_ORG_SETTINGS,
      ...s,
    };
  }

  async getOrgSettingsById(organizationId: string): Promise<OrgSettings> {
    const org = await OrganizationModel.findById(organizationId).lean<{
      settings?: Partial<OrgSettings> | null;
    } | null>();
    if (!org) {
      return DEFAULT_ORG_SETTINGS;
    }
    return { ...DEFAULT_ORG_SETTINGS, ...(org.settings ?? {}) };
  }
}
