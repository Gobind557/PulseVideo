import mongoose from 'mongoose';
import {
  MembershipModel,
  type MembershipLean,
  type MembershipRole,
} from '../../infrastructure/db/models/membership.model.js';
import { OrganizationModel } from '../../infrastructure/db/models/organization.model.js';
import { RefreshTokenModel } from '../../infrastructure/db/models/refresh-token.model.js';
import { UserModel } from '../../infrastructure/db/models/user.model.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';

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
}
