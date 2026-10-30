import { Schema, model, type Document, type Types } from 'mongoose';
import { generateSearchTokens } from '../utils/searchTokens.js';

export type PatientCondition = 'stable' | 'under_observation' | 'critical' | 'recovering' | 'discharged';
export type PatientGender = 'male' | 'female' | 'other';

export interface IPatient extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  age: number;
  gender: PatientGender;
  phone: string;
  email?: string;
  condition: PatientCondition;
  diagnosis?: string;
  admissionDate: Date;
  notes?: string;
  doctorId: Types.ObjectId;
  doctorName: string;
  searchTokens: string[];
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  version: number;
  // Compatibility fields
  userId?: Types.ObjectId;
  bloodGroup?: string;
  medicalHistory?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
      minlength: [2, 'Patient name must be at least 2 characters'],
      maxlength: [100, 'Patient name cannot exceed 100 characters'],
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [0, 'Age cannot be negative'],
      max: [130, 'Age cannot exceed 130'],
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    condition: {
      type: String,
      enum: ['stable', 'under_observation', 'critical', 'recovering', 'discharged'],
      default: 'stable',
      required: [true, 'Condition status is required'],
    },
    diagnosis: {
      type: String,
      maxlength: [200, 'Diagnosis cannot exceed 200 characters'],
      trim: true,
    },
    admissionDate: {
      type: Date,
      required: [true, 'Admission date is required'],
      default: Date.now,
    },
    notes: {
      type: String,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
      trim: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Assigned doctor is required'],
    },
    doctorName: {
      type: String,
      required: [true, 'Doctor name copy is required for extended reference pattern'],
      trim: true,
      default: 'Unassigned',
    },
    searchTokens: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // Compatibility fields for legacy controllers
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    bloodGroup: {
      type: String,
      trim: true,
    },
    medicalHistory: {
      type: [String],
      default: [],
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
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
        delete ret.searchTokens; // Exclude internal search index tokens from API responses
        if (ret.admissionDate instanceof Date) {
          ret.admissionDate = ret.admissionDate.toISOString().split('T')[0];
        } else if (typeof ret.admissionDate === 'string' && ret.admissionDate.includes('T')) {
          ret.admissionDate = ret.admissionDate.split('T')[0];
        }
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

// Pre-save hook to populate searchTokens from name, diagnosis, and phone digits
patientSchema.pre('save', function () {
  if (
    this.isModified('name') ||
    this.isModified('diagnosis') ||
    this.isModified('phone') ||
    !this.searchTokens ||
    this.searchTokens.length === 0
  ) {
    this.searchTokens = generateSearchTokens([this.name, this.diagnosis, this.phone]);
  }
});

// Indexes matching the database plan and R01 Equality-Sort-Range
patientSchema.index({ doctorId: 1, admissionDate: -1, _id: -1 }); // Doctor's patient list; doctor filter on Patients
patientSchema.index({ doctorId: 1, condition: 1, admissionDate: -1 }); // Doctor's list filtered by condition
patientSchema.index({ condition: 1, admissionDate: -1, _id: -1 }); // Condition filter; critical count on dashboard
patientSchema.index({ admissionDate: -1, _id: -1 }); // Default Patients list, date-range filter, admissions chart
patientSchema.index({ name: 1, _id: 1 }, { collation: { locale: 'en', strength: 2 } }); // Name A-Z sort
patientSchema.index({ searchTokens: 1 }); // Fast prefix search

export const Patient = model<IPatient>('Patient', patientSchema);
