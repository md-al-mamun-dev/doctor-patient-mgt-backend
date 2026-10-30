import { Schema, model, type Document, type Types } from 'mongoose';

export type RefreshTokenStatus = 'active' | 'used' | 'revoked';
export type RevokedReason = 'logout' | 'reuse' | 'password_change' | 'disabled' | 'admin';

export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  id: string;
  userId: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  status: RefreshTokenStatus;
  familyStartedAt: Date;
  expiresAt: Date;
  revokedReason?: RevokedReason;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    familyId: {
      type: String,
      required: [true, 'Family ID is required'],
      trim: true,
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'used', 'revoked'],
      default: 'active',
    },
    familyStartedAt: {
      type: Date,
      required: [true, 'Family start timestamp is required'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry timestamp is required'],
    },
    revokedReason: {
      type: String,
      enum: ['logout', 'reuse', 'password_change', 'disabled', 'admin'],
    },
    ip: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
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
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes matching the database plan
refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
refreshTokenSchema.index({ familyId: 1 });
refreshTokenSchema.index({ userId: 1, status: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Automatic TTL expiration

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
