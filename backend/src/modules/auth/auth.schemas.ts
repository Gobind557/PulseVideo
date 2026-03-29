import { z } from 'zod';

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(1).max(200),
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationId: z.string().min(1),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
  organizationId: z.string().min(1),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(1),
});
