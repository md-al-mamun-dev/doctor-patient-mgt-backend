import { Schema, model, type Document, type Types } from 'mongoose';

export interface IDoctor extends Document {
  userId: Types.ObjectId;
  specialty: string;
  department: string;
  phone?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    specialty: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

doctorSchema.index({ specialty: 1 });
doctorSchema.index({ department: 1 });

export const Doctor = model<IDoctor>('Doctor', doctorSchema);

