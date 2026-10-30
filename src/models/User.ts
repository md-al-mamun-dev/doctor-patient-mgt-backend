import { Schema, model, type Document, type Types } from 'mongoose';

export type UserRole = 'admin' | 'staff' | 'doctor' | 'patient';
export type UserStatus = 'active' | 'disabled';

export interface IUser extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Never return password hash by default
    },
    role: {
      type: String,
      enum: ['admin', 'staff', 'doctor', 'patient'],
      default: 'staff',
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },
    mustChangePassword: {
      type: Boolean,
      default: true,
    },
    failedLoginCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Unique index on email
userSchema.index({ email: 1 }, { unique: true });

export const User = model<IUser>('User', userSchema);
