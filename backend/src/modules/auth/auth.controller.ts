import type { Request, Response, NextFunction } from 'express';
import type { AuthService } from './auth.service.js';

/** Controllers stay thin: map HTTP ↔ service calls only. */
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, organizationName } = req.body as {
        email: string;
        password: string;
        organizationName: string;
      };
      const tokens = await this.authService.register(email, password, organizationName);
      res.status(201).json(tokens);
    } catch (e) {
      next(e);
    }
  };

  registerInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, inviteToken } = req.body as {
        email: string;
        password: string;
        inviteToken: string;
      };
      const tokens = await this.authService.registerWithInvite(email, password, inviteToken);
      res.status(201).json(tokens);
    } catch (e) {
      next(e);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, organizationId } = req.body as {
        email: string;
        password: string;
        organizationId: string;
      };
      const tokens = await this.authService.login(email, password, organizationId);
      res.json(tokens);
    } catch (e) {
      next(e);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken, organizationId } = req.body as {
        refreshToken: string;
        organizationId: string;
      };
      const tokens = await this.authService.refresh(refreshToken, organizationId);
      res.json(tokens);
    } catch (e) {
      next(e);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body as { refreshToken: string };
      await this.authService.logout(refreshToken);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };
}
