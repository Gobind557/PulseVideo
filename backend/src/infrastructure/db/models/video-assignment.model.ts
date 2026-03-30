import mongoose, { Schema } from 'mongoose';

/**
 * Viewer scope: a viewer can only read videos explicitly assigned to them.
 * Editors/admins are not restricted by assignments.
 */
const videoAssignmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    videoId: { type: Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

videoAssignmentSchema.index({ organizationId: 1, videoId: 1, userId: 1 }, { unique: true });

export const VideoAssignmentModel =
  mongoose.models.VideoAssignment ?? mongoose.model('VideoAssignment', videoAssignmentSchema);

export type VideoAssignmentLean = mongoose.FlattenMaps<
  mongoose.InferSchemaType<typeof videoAssignmentSchema>
> & { _id: mongoose.Types.ObjectId };

