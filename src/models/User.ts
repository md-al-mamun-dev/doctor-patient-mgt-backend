import { Schema, model, type Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'doctor' | 'patient';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'doctor', 'patient'], default: 'patient' },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);

