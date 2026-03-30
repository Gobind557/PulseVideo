import mongoose, { Schema } from 'mongoose';
import { MEMBERSHIP_ROLE_ORDER } from './membership.model.js';

const orgInviteSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    /** Optional email restriction; if set, only this email can redeem the invite. */
    email: { type: String, default: null, index: true },
    role: { type: String, enum: MEMBERSHIP_ROLE_ORDER, required: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// TTL cleanup for expired invites (MongoDB deletes after expiresAt passes)
orgInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OrgInviteModel =
  mongoose.models.OrgInvite ?? mongoose.model('OrgInvite', orgInviteSchema);

export type OrgInviteLean = mongoose.FlattenMaps<
  mongoose.InferSchemaType<typeof orgInviteSchema>
> & { _id: mongoose.Types.ObjectId };

