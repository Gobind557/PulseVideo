import type { RequestHandler } from 'express';
import type { MembershipRole } from '../infrastructure/db/models/membership.model.js';
import { roleMeetsMinimum } from '../infrastructure/db/models/membership.model.js';
import { ForbiddenError } from '../shared/errors.js';

/** Minimum role required (e.g. editor → allows editor + admin). */
export function requireRole(minimum: MembershipRole): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      next(new ForbiddenError('Not authenticated'));
      return;
    }
    if (!roleMeetsMinimum(user.role, minimum)) {
      next(new ForbiddenError('Insufficient role'));
      return;
    }
    next();
  };
}
