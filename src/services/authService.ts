import { randomUUID } from 'node:crypto';
import { User, type IUser } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/errors.js';
import {
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
  checkBreachedPassword,
} from '../utils/password.js';
import {
  hashToken,
  generateRefreshToken,
  signAccessToken,
  calculateTokenExpiresAt,
  REFRESH_IDLE_TTL_MS,
  SESSION_MAX_TTL_MS,
} from '../utils/token.js';
import { invalidateCachedUser } from '../utils/userCache.js';
import type { LoginInput, ChangePasswordInput } from '../validators/authValidator.js';

export interface SessionInfo {
  startedAt: Date;
  idleExpiresAt: Date;
  expiresAt: Date;
}

export interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    mustChangePassword: boolean;
  };
  session: SessionInfo;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  static async login(
    input: LoginInput,
    ip?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    const user = await User.findOne({ email: input.email }).select('+passwordHash');

    // 1. Uniform constant-time handling for missing user
    if (!user) {
      await verifyDummyPassword(input.password);
      await AuditLog.create({
        action: 'auth.login_failed',
        actorId: null,
        ip,
        userAgent,
        fields: ['email'],
      });
      throw new AppError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
    }

    // 2. Account Lockout Check (5 failed logins = 15 min lock)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await verifyDummyPassword(input.password);
      throw new AppError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
    }

    // 3. Disabled Account Check
    if (user.status === 'disabled') {
      await verifyDummyPassword(input.password);
      throw new AppError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
    }

    // 4. Verify Argon2id Password
    const isValid = await verifyPassword(user.passwordHash, input.password);

    if (!isValid) {
      user.failedLoginCount = (user.failedLoginCount || 0) + 1;
      let isLockedNow = false;

      if (user.failedLoginCount >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
        isLockedNow = true;
      }

      await user.save();

      await AuditLog.create({
        action: isLockedNow ? 'auth.lockout' : 'auth.login_failed',
        actorId: user._id,
        entityType: 'user',
        entityId: user._id,
        ip,
        userAgent,
      });

      throw new AppError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
    }

    // 5. Successful Login: Reset counters and record login timestamp
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    // 6. Start new Session Family
    const familyId = randomUUID();
    const familyStartedAt = new Date();
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = calculateTokenExpiresAt(familyStartedAt);

    await RefreshToken.create({
      userId: user._id,
      familyId,
      tokenHash,
      status: 'active',
      familyStartedAt,
      expiresAt,
      ip,
      userAgent,
    });

    // 7. Issue Access Token
    const accessToken = signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      sid: familyId,
    });

    // 8. Audit Log
    await AuditLog.create({
      action: 'auth.login',
      actorId: user._id,
      entityType: 'user',
      entityId: user._id,
      ip,
      userAgent,
    });

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      session: {
        startedAt: familyStartedAt,
        idleExpiresAt: new Date(Date.now() + REFRESH_IDLE_TTL_MS),
        expiresAt,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  static async refresh(
    rawRefreshToken: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ session: SessionInfo; accessToken: string; refreshToken: string }> {
    if (!rawRefreshToken) {
      throw new AppError('Refresh token required', 401, 'UNAUTHORIZED');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const tokenDoc = await RefreshToken.findOne({ tokenHash });

    if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
      throw new AppError('Refresh token expired or invalid', 401, 'UNAUTHORIZED');
    }

    // Reuse Detection: If token was already rotated or revoked, terminate entire family!
    if (tokenDoc.status === 'used' || tokenDoc.status === 'revoked') {
      await RefreshToken.updateMany(
        { familyId: tokenDoc.familyId, status: { $ne: 'revoked' } },
        { status: 'revoked', revokedReason: 'reuse' }
      );

      await AuditLog.create({
        action: 'auth.refresh_reuse',
        actorId: tokenDoc.userId,
        entityType: 'refreshToken',
        entityId: tokenDoc._id,
        ip,
        userAgent,
      });

      invalidateCachedUser(tokenDoc.userId.toString());
      throw new AppError('Refresh token reuse detected. Session terminated.', 401, 'UNAUTHORIZED');
    }

    // Atomic rotation of active token
    const rotated = await RefreshToken.findOneAndUpdate(
      { _id: tokenDoc._id, status: 'active' },
      { status: 'used' },
      { returnDocument: 'after' }
    );

    if (!rotated) {
      throw new AppError('Refresh collision detected', 401, 'UNAUTHORIZED');
    }

    // Verify user is still active
    const user = await User.findById(tokenDoc.userId);
    if (!user || user.status === 'disabled') {
      throw new AppError('User account is no longer active', 401, 'UNAUTHORIZED');
    }

    // Issue next token in family
    const newRawRefreshToken = generateRefreshToken();
    const newHash = hashToken(newRawRefreshToken);
    const newExpiresAt = calculateTokenExpiresAt(tokenDoc.familyStartedAt);

    await RefreshToken.create({
      userId: user._id,
      familyId: tokenDoc.familyId,
      tokenHash: newHash,
      status: 'active',
      familyStartedAt: tokenDoc.familyStartedAt,
      expiresAt: newExpiresAt,
      ip,
      userAgent,
    });

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      sid: tokenDoc.familyId,
    });

    return {
      session: {
        startedAt: tokenDoc.familyStartedAt,
        idleExpiresAt: new Date(Date.now() + REFRESH_IDLE_TTL_MS),
        expiresAt: newExpiresAt,
      },
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  static async logout(rawRefreshToken?: string | null): Promise<void> {
    if (!rawRefreshToken) return;

    const tokenHash = hashToken(rawRefreshToken);
    const tokenDoc = await RefreshToken.findOne({ tokenHash });

    if (tokenDoc) {
      await RefreshToken.updateMany(
        { familyId: tokenDoc.familyId, status: { $ne: 'revoked' } },
        { status: 'revoked', revokedReason: 'logout' }
      );

      await AuditLog.create({
        action: 'auth.logout',
        actorId: tokenDoc.userId,
        entityType: 'user',
        entityId: tokenDoc.userId,
      });

      invalidateCachedUser(tokenDoc.userId.toString());
    }
  }

  static async logoutAll(userId: string): Promise<void> {
    await RefreshToken.updateMany(
      { userId, status: { $ne: 'revoked' } },
      { status: 'revoked', revokedReason: 'logout' }
    );

    await AuditLog.create({
      action: 'auth.logout_all',
      actorId: userId,
      entityType: 'user',
      entityId: userId,
    });

    invalidateCachedUser(userId);
  }

  static async getMe(
    userId: string,
    familyId?: string
  ): Promise<{
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      mustChangePassword: boolean;
    };
    session?: SessionInfo;
  }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 401, 'UNAUTHORIZED');
    }

    let session: SessionInfo | undefined;
    if (familyId) {
      const token = await RefreshToken.findOne({ familyId, status: { $ne: 'revoked' } }).sort({
        createdAt: -1,
      });
      if (token) {
        session = {
          startedAt: token.familyStartedAt,
          idleExpiresAt: new Date(Date.now() + REFRESH_IDLE_TTL_MS),
          expiresAt: token.expiresAt,
        };
      }
    }

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      ...(session && { session }),
    };
  }

  static async changePassword(
    userId: string,
    input: ChangePasswordInput,
    ip?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    if (checkBreachedPassword(input.newPassword)) {
      throw new AppError(
        'This password has been identified in data breaches and cannot be used.',
        400,
        'VALIDATION_ERROR',
        [{ path: 'newPassword', message: 'Choose a more secure password' }]
      );
    }

    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      throw new AppError('User not found', 401, 'UNAUTHORIZED');
    }

    const isMatch = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!isMatch) {
      // Must return 400 VALIDATION_ERROR with path: currentPassword
      throw new AppError(
        'Current password is incorrect.',
        400,
        'VALIDATION_ERROR',
        [{ path: 'currentPassword', message: 'Current password is incorrect.' }]
      );
    }

    const newHash = await hashPassword(input.newPassword);
    user.passwordHash = newHash;
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    await user.save();

    // Revoke all existing sessions on password change
    await RefreshToken.updateMany(
      { userId: user._id, status: { $ne: 'revoked' } },
      { status: 'revoked', revokedReason: 'password_change' }
    );

    invalidateCachedUser(user._id.toString());

    // Start fresh session family for this sign-in
    const familyId = randomUUID();
    const familyStartedAt = new Date();
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = calculateTokenExpiresAt(familyStartedAt);

    await RefreshToken.create({
      userId: user._id,
      familyId,
      tokenHash,
      status: 'active',
      familyStartedAt,
      expiresAt,
      ip,
      userAgent,
    });

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      sid: familyId,
    });

    await AuditLog.create({
      action: 'auth.change_password',
      actorId: user._id,
      entityType: 'user',
      entityId: user._id,
      ip,
      userAgent,
    });

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      session: {
        startedAt: familyStartedAt,
        idleExpiresAt: new Date(Date.now() + REFRESH_IDLE_TTL_MS),
        expiresAt,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }
}
