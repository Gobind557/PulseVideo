import mongoose, { Schema } from 'mongoose';

export type UserDocument = mongoose.Document &
  mongoose.InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User ?? mongoose.model('User', userSchema);
