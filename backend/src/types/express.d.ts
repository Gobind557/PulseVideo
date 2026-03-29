import type { AuthUser } from '../shared/types/express.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by authenticateJWT — never trust client-sent org headers. */
      user?: AuthUser;
    }
  }
}

export {};
