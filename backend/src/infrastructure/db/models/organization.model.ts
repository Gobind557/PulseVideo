import mongoose, { Schema } from 'mongoose';
import type { MembershipRole } from './membership.model.js';

export type OrgSettings = {
  defaultRoleForNewUsers: MembershipRole;
  maxVideoFileSizeMb: number;
  allowedFormats: string;
  sensitivityLevel: 'low' | 'medium' | 'high';
  automaticProcessing: boolean;
};

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  defaultRoleForNewUsers: 'viewer',
  maxVideoFileSizeMb: 500,
  allowedFormats: 'MP4, MOV, WEBM',
  sensitivityLevel: 'medium',
  automaticProcessing: true,
};

export type OrganizationDocument = mongoose.Document &
  mongoose.InferSchemaType<typeof orgSchema> & { _id: mongoose.Types.ObjectId };

const orgSettingsSchema = new Schema(
  {
    defaultRoleForNewUsers: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
      default: DEFAULT_ORG_SETTINGS.defaultRoleForNewUsers,
    },
    maxVideoFileSizeMb: {
      type: Number,
      default: DEFAULT_ORG_SETTINGS.maxVideoFileSizeMb,
      min: 1,
      max: 10240,
    },
    allowedFormats: { type: String, default: DEFAULT_ORG_SETTINGS.allowedFormats, trim: true },
    sensitivityLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: DEFAULT_ORG_SETTINGS.sensitivityLevel,
    },
    automaticProcessing: { type: Boolean, default: DEFAULT_ORG_SETTINGS.automaticProcessing },
  },
  { _id: false }
);

const orgSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    settings: { type: orgSettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const OrganizationModel =
  mongoose.models.Organization ?? mongoose.model('Organization', orgSchema);
