import { Schema, model, type Document, type Types } from 'mongoose';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  id: string;
  at: Date;
  actorId?: Types.ObjectId | null;
  action: string;
  entityType?: string;
  entityId?: Types.ObjectId | null;
  fields: string[];
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    at: {
      type: Date,
      required: [true, 'Timestamp is required'],
      default: Date.now,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true,
    },
    entityType: {
      type: String,
      trim: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    fields: {
      type: [String],
      default: [],
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
auditLogSchema.index({ entityType: 1, entityId: 1, at: -1 }); // History of one record
auditLogSchema.index({ actorId: 1, at: -1 }); // Everything one user did
auditLogSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }); // Retention TTL: 365 days

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
