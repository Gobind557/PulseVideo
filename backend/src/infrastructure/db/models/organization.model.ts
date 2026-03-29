import mongoose, { Schema } from 'mongoose';

export type OrganizationDocument = mongoose.Document &
  mongoose.InferSchemaType<typeof orgSchema> & { _id: mongoose.Types.ObjectId };

const orgSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const OrganizationModel =
  mongoose.models.Organization ?? mongoose.model('Organization', orgSchema);
