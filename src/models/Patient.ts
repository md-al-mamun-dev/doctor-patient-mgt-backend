import { Schema, model, type Document, type Types } from 'mongoose';

export interface IPatient extends Document {
  userId: Types.ObjectId;
  doctorId?: Types.ObjectId;
  age: number;
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string;
  medicalHistory?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor' },
    age: { type: Number, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    bloodGroup: { type: String, trim: true },
    medicalHistory: [{ type: String }],
  },
  { timestamps: true }
);

patientSchema.index({ doctorId: 1 });

export const Patient = model<IPatient>('Patient', patientSchema);

