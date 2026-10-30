import { Schema, model, type Document, type Types } from 'mongoose';
import { generateSearchTokens } from '../utils/searchTokens.js';

export interface IDoctor extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  patientCount: number;
  searchTokens: string[];
  createdBy?: Types.ObjectId;
  version: number;
  // Compatibility fields
  specialty: string;
  department: string;
  isAvailable: boolean;
  userId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    name: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
      minlength: [2, 'Doctor name must be at least 2 characters'],
      maxlength: [100, 'Doctor name cannot exceed 100 characters'],
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true,
      minlength: [2, 'Specialization must be at least 2 characters'],
      maxlength: [100, 'Specialization cannot exceed 100 characters'],
    },
    hospital: {
      type: String,
      required: [true, 'Hospital is required'],
      trim: true,
      minlength: [2, 'Hospital must be at least 2 characters'],
      maxlength: [100, 'Hospital cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    patientCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    searchTokens: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // Compatibility fields for legacy controllers/validators
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
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
        delete ret.searchTokens; // Internal search tokens excluded from API responses
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

// Virtual aliases for compatibility between 'specialty'/'specialization' and 'department'/'hospital'
doctorSchema.virtual('specialty')
  .get(function (this: IDoctor) {
    return this.specialization;
  })
  .set(function (this: IDoctor, val: string) {
    this.specialization = val;
  });

doctorSchema.virtual('department')
  .get(function (this: IDoctor) {
    return this.hospital;
  })
  .set(function (this: IDoctor, val: string) {
    this.hospital = val;
  });

// Pre-save hook to populate searchTokens from name, email, hospital, specialization, phone
doctorSchema.pre('save', function () {
  if (
    this.isModified('name') ||
    this.isModified('specialization') ||
    this.isModified('hospital') ||
    this.isModified('email') ||
    this.isModified('phone') ||
    !this.searchTokens ||
    this.searchTokens.length === 0
  ) {
    this.searchTokens = generateSearchTokens([
      this.name,
      this.specialization,
      this.hospital,
      this.email,
      this.phone,
    ]);
  }
});

// Indexes matching the database plan and R01 Equality-Sort-Range
doctorSchema.index({ email: 1 }, { unique: true });
doctorSchema.index({ createdAt: -1, _id: -1 }); // Default list, newest first, stable pagination
doctorSchema.index({ specialization: 1, createdAt: -1, _id: -1 }); // Specialization filter
doctorSchema.index({ hospital: 1, createdAt: -1, _id: -1 }); // Hospital filter
doctorSchema.index({ patientCount: -1, _id: -1 }); // "Most patients" sort and dashboard top 10
doctorSchema.index({ name: 1, _id: 1 }, { collation: { locale: 'en', strength: 2 } }); // Name A-Z sort
doctorSchema.index({ searchTokens: 1 }); // Fast prefix search

export const Doctor = model<IDoctor>('Doctor', doctorSchema);
