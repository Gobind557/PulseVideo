import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Env } from '../config/env.js';
import type { MembershipRole } from '../infrastructure/db/models/membership.model.js';
import { UnauthorizedError } from '../shared/errors.js';

type AccessPayload = {
  sub: string;
  org: string;
  role: MembershipRole;
  typ?: string;
};

export function authenticateJWT(env: Env): RequestHandler {
  return (req, _res, next) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      if (!token) {
        throw new UnauthorizedError('Missing bearer token');
      }
      const decoded = jwt.verify(token, env.JWT_SECRET) as AccessPayload;
      if (decoded.typ != null && decoded.typ !== 'access') {
        throw new UnauthorizedError('Invalid token type');
      }
      req.user = {
        userId: decoded.sub,
        organizationId: decoded.org,
        role: decoded.role,
      };
      next();
    } catch (e) {
      next(e instanceof UnauthorizedError ? e : new UnauthorizedError('Invalid token'));
    }
  };
}
