import { Types } from 'mongoose';
import { User, type IUser } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/errors.js';
import { hashPassword, generateTemporaryPassword } from '../utils/password.js';
import { generateSearchTokens } from '../utils/searchTokens.js';
import { invalidateCachedUser } from '../utils/userCache.js';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserQueryInput,
} from '../validators/userValidator.js';

export interface FormattedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class UserService {
  static async getUsers(query: UserQueryInput) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(Math.max(1, query.limit || 10), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    // 1. Role filter (supports comma-separated list e.g. "admin,staff")
    if (query.role) {
      const roles = query.role.split(',').map((r) => r.trim()).filter(Boolean);
      const validRoles = new Set(['admin', 'staff', 'doctor', 'patient']);
      for (const r of roles) {
        if (!validRoles.has(r)) {
          throw new AppError(`Invalid role filter: "${r}". Allowed: admin, staff`, 400, 'VALIDATION_ERROR', [
            { path: 'role', message: `Invalid role: ${r}` },
          ]);
        }
      }
      if (roles.length === 1) {
        filter.role = roles[0];
      } else if (roles.length > 1) {
        filter.role = { $in: roles };
      }
    }

    // 2. Status filter (supports comma-separated list e.g. "active,disabled")
    if (query.status) {
      const statuses = query.status.split(',').map((s) => s.trim()).filter(Boolean);
      const validStatuses = new Set(['active', 'disabled']);
      for (const s of statuses) {
        if (!validStatuses.has(s)) {
          throw new AppError(`Invalid status filter: "${s}". Allowed: active, disabled`, 400, 'VALIDATION_ERROR', [
            { path: 'status', message: `Invalid status: ${s}` },
          ]);
        }
      }
      if (statuses.length === 1) {
        filter.status = statuses[0];
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses };
      }
    }

    // 3. Search query: prefix match against indexed searchTokens
    if (query.q) {
      const words = query.q
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .slice(0, 5)
        .filter(Boolean);

      if (words.length > 0) {
        const regexConditions = words.map((word) => {
          const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`^${escaped}`);
        });
        filter.searchTokens = { $all: regexConditions };
      }
    }

    // 4. Deterministic Sort matching indexed fields with tie-breaker
    let sortObj: Record<string, 1 | -1>;
    switch (query.sort) {
      case 'name':
        sortObj = { name: 1, _id: 1 };
        break;
      case '-lastLoginAt':
        sortObj = { lastLoginAt: -1, _id: -1 };
        break;
      case '-createdAt':
      default:
        sortObj = { createdAt: -1, _id: -1 };
        break;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -searchTokens -__v')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const formattedUsers: FormattedUser[] = users.map((u: any) => {
      const id = u._id ? u._id.toString() : u.id;
      delete u._id;
      return {
        ...u,
        id,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      users: formattedUsers,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
    };
  }

  static async createUser(
    input: CreateUserInput,
    actorId: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ user: IUser; temporaryPassword: string }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check duplicate email
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      throw new AppError('A user with this email already exists', 409, 'CONFLICT', [
        { path: 'email', message: 'Email is already registered' },
      ]);
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await User.create({
      name: input.name.trim(),
      email: normalizedEmail,
      role: input.role,
      status: 'active',
      passwordHash,
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
      version: 1,
    });

    await AuditLog.create({
      action: 'user.create',
      actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
      entityType: 'user',
      entityId: user._id,
      fields: ['name', 'email', 'role', 'status'],
      ip,
      userAgent,
    });

    return { user, temporaryPassword };
  }

  static async getUserById(id: string): Promise<FormattedUser> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const user = await User.findById(id).select('-passwordHash -searchTokens -__v').lean();
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const formattedId = user._id ? user._id.toString() : (user as any).id;
    delete (user as any)._id;

    return {
      ...(user as any),
      id: formattedId,
    };
  }

  static async updateUser(
    id: string,
    input: UpdateUserInput,
    expectedVersion: number,
    actorId: string,
    ip?: string,
    userAgent?: string
  ): Promise<IUser> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    // Guardrail: Admin cannot change their own role or status
    if (actorId === id && (input.role !== undefined || input.status !== undefined)) {
      throw new AppError('An admin cannot change their own role or status', 409, 'CONFLICT');
    }

    // Guardrail: Refuse any change that would leave no active admin
    if (
      user.role === 'admin' &&
      user.status === 'active' &&
      (input.role === 'staff' || input.status === 'disabled')
    ) {
      const otherActiveAdmins = await User.countDocuments({
        role: 'admin',
        status: 'active',
        _id: { $ne: user._id },
      });
      if (otherActiveAdmins === 0) {
        throw new AppError('At least one active admin is required.', 409, 'CONFLICT');
      }
    }

    // Optimistic Concurrency Control Check
    if (user.version !== expectedVersion) {
      throw new AppError(
        'Precondition failed: resource has been modified',
        412,
        'PRECONDITION_FAILED',
        undefined,
        user.toJSON()
      );
    }

    const updateFields: Record<string, any> = {};
    if (input.name !== undefined) {
      updateFields.name = input.name.trim();
      updateFields.searchTokens = generateSearchTokens([input.name.trim(), user.email]);
    }
    if (input.role !== undefined) {
      updateFields.role = input.role;
    }
    if (input.status !== undefined) {
      updateFields.status = input.status;
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, version: expectedVersion },
      {
        $set: updateFields,
        $inc: { version: 1 },
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedUser) {
      const current = await User.findById(id);
      if (!current) throw new AppError('User not found', 404, 'NOT_FOUND');
      throw new AppError(
        'Precondition failed: resource has been modified',
        412,
        'PRECONDITION_FAILED',
        undefined,
        current.toJSON()
      );
    }

    // Changing role or disabling ends user's active sessions immediately
    if (input.role !== undefined || input.status === 'disabled') {
      await RefreshToken.updateMany(
        { userId: user._id, status: { $ne: 'revoked' } },
        { status: 'revoked', revokedReason: input.status === 'disabled' ? 'disabled' : 'admin' }
      );
      invalidateCachedUser(id);
    }

    await AuditLog.create({
      action: 'user.update',
      actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
      entityType: 'user',
      entityId: user._id,
      fields: Object.keys(input),
      ip,
      userAgent,
    });

    return updatedUser;
  }

  static async resetPassword(
    id: string,
    actorId: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ temporaryPassword: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    user.passwordHash = passwordHash;
    user.mustChangePassword = true;
    user.passwordChangedAt = new Date();
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.version += 1;
    await user.save();

    // Revoke all active sessions on password reset
    await RefreshToken.updateMany(
      { userId: user._id, status: { $ne: 'revoked' } },
      { status: 'revoked', revokedReason: 'admin' }
    );
    invalidateCachedUser(id);

    await AuditLog.create({
      action: 'user.reset_password',
      actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
      entityType: 'user',
      entityId: user._id,
      fields: ['passwordHash', 'mustChangePassword'],
      ip,
      userAgent,
    });

    return { temporaryPassword };
  }

  static async unlockUser(
    id: string,
    actorId: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    user.failedLoginCount = 0;
    user.lockedUntil = null;
    await user.save();

    invalidateCachedUser(id);

    await AuditLog.create({
      action: 'user.unlock',
      actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
      entityType: 'user',
      entityId: user._id,
      fields: ['failedLoginCount', 'lockedUntil'],
      ip,
      userAgent,
    });
  }

  static async revokeSessions(
    id: string,
    actorId: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    await RefreshToken.updateMany(
      { userId: user._id, status: { $ne: 'revoked' } },
      { status: 'revoked', revokedReason: 'admin' }
    );

    invalidateCachedUser(id);

    await AuditLog.create({
      action: 'user.revoke_sessions',
      actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
      entityType: 'user',
      entityId: user._id,
      ip,
      userAgent,
    });
  }
}

