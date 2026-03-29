import mongoose, { Schema } from 'mongoose';

/** Role ordering used by requireRole — higher index = more privilege. */
export const MEMBERSHIP_ROLE_ORDER = ['viewer', 'editor', 'admin'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLE_ORDER)[number];

export function roleMeetsMinimum(role: MembershipRole, minimum: MembershipRole): boolean {
  return MEMBERSHIP_ROLE_ORDER.indexOf(role) >= MEMBERSHIP_ROLE_ORDER.indexOf(minimum);
}

export type MembershipDocument = mongoose.Document &
  mongoose.InferSchemaType<typeof membershipSchema> & { _id: mongoose.Types.ObjectId };

const membershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    role: {
      type: String,
      enum: MEMBERSHIP_ROLE_ORDER,
      required: true,
    },
  },
  { timestamps: true }
);

membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export const MembershipModel =
  mongoose.models.Membership ?? mongoose.model('Membership', membershipSchema);

export type MembershipLean = mongoose.FlattenMaps<
  mongoose.InferSchemaType<typeof membershipSchema>
> & { _id: mongoose.Types.ObjectId };
