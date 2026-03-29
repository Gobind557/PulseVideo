import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Env } from '../../config/env.js';
import { getJwtRefreshSecret } from '../../config/env.js';
import { RefreshTokenModel } from '../../infrastructure/db/models/refresh-token.model.js';
import type { MembershipRole } from '../../infrastructure/db/models/membership.model.js';
import { UserModel } from '../../infrastructure/db/models/user.model.js';
import { ConflictError, UnauthorizedError } from '../../shared/errors.js';
import { OrgService } from '../orgs/org.service.js';

const SALT_ROUNDS = 10;

/**
 * Tokens: access JWT carries tenant (organizationId) + role — never accept org from client without membership check.
 * Refresh tokens are JWTs keyed by SHA-256 hash in Mongo for revocation.
 */
export class AuthService {
  constructor(
    private readonly env: Env,
    private readonly orgService: OrgService
  ) {}

  async register(email: string, password: string, organizationName: string) {
    const existing = await UserModel.findOne({ email }).lean();
    if (existing) {
      throw new ConflictError('Email already registered');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UserModel.create({ email, passwordHash });
    const { organizationId, role } = await this.orgService.createOrganizationWithAdmin(
      String(user._id),
      organizationName
    );
    return this.issueTokens(String(user._id), organizationId, role);
  }

  async login(email: string, password: string, organizationId: string) {
    const user = await UserModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const role = await this.orgService.assertMembership(String(user._id), organizationId);
    return this.issueTokens(String(user._id), organizationId, role);
  }

  async refresh(refreshToken: string, organizationId: string) {
    let decoded: { sub: string; typ?: string };
    try {
      decoded = jwt.verify(refreshToken, getJwtRefreshSecret(this.env)) as {
        sub: string;
        typ?: string;
      };
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
    if (decoded.typ !== 'refresh') {
      throw new UnauthorizedError('Invalid refresh token');
    }
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const record = await RefreshTokenModel.findOne({ tokenHash: hash, revokedAt: null }).lean<{
      expiresAt: Date;
    } | null>();
    if (!record) {
      throw new UnauthorizedError('Refresh token revoked or unknown');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh token expired');
    }
    const role = await this.orgService.assertMembership(decoded.sub, organizationId);
    return this.issueTokens(decoded.sub, organizationId, role);
  }

  async logout(refreshToken: string) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await RefreshTokenModel.updateOne(
      { tokenHash: hash },
      { $set: { revokedAt: new Date() } }
    );
  }

  private async issueTokens(userId: string, organizationId: string, role: MembershipRole) {
    const accessOpts = { expiresIn: this.env.JWT_ACCESS_EXPIRES } as SignOptions;
    const refreshOpts = { expiresIn: this.env.JWT_REFRESH_EXPIRES } as SignOptions;
    const accessToken = jwt.sign(
      { sub: userId, org: organizationId, role, typ: 'access' },
      this.env.JWT_SECRET,
      accessOpts
    );
    const refreshToken = jwt.sign(
      { sub: userId, typ: 'refresh' },
      getJwtRefreshSecret(this.env),
      refreshOpts
    );
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.parseDurationMs(this.env.JWT_REFRESH_EXPIRES));
    await RefreshTokenModel.create({ userId, tokenHash: hash, expiresAt });
    return { accessToken, refreshToken, organizationId, role };
  }

  private parseDurationMs(spec: string): number {
    const m = spec.match(/^(\d+)([smhd])$/);
    if (!m) {
      return 7 * 24 * 3600 * 1000;
    }
    const n = Number(m[1]);
    const u = m[2];
    const mult =
      u === 's' ? 1000 : u === 'm' ? 60_000 : u === 'h' ? 3_600_000 : 86_400_000;
    return n * mult;
  }
}
