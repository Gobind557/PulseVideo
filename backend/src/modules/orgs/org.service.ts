import mongoose from 'mongoose';
import {
  MembershipModel,
  type MembershipLean,
  type MembershipRole,
} from '../../infrastructure/db/models/membership.model.js';
import { OrganizationModel } from '../../infrastructure/db/models/organization.model.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';

/**
 * Membership is the tenant boundary: all org-scoped operations validate via this service.
 */
export class OrgService {
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
}
