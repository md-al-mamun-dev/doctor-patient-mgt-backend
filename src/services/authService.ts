import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, type IUser } from '../models/User.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/logger.js';
import type { RegisterInput, LoginInput } from '../validators/authValidator.js';

export class AuthService {
  static async register(input: RegisterInput): Promise<{ user: Partial<IUser>; token: string }> {
    const existing = await User.findOne({ email: input.email });
    if (existing) {
      throw new AppError('A user with this email already exists', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as any }
    );

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  static async login(input: LoginInput): Promise<{ user: Partial<IUser>; token: string }> {
    const user = await User.findOne({ email: input.email });
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as any }
    );

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }
}

