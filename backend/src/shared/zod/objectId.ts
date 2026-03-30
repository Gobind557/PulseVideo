import { z } from 'zod';
import mongoose from 'mongoose';

/** Validates a MongoDB ObjectId string at the API boundary. */
export const objectIdSchema = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' });

