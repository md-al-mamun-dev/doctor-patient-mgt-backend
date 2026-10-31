import { Schema, model, Document, Types } from 'mongoose';

export interface ISpecialization extends Document {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const specializationSchema = new Schema<ISpecialization>(
  {
    name: {
      type: String,
      required: [true, 'Specialization name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Specialization name must be at least 2 characters'],
      maxlength: [100, 'Specialization name cannot exceed 100 characters'],
    },
  },
  {
    timestamps: true,
  }
);

specializationSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = (ret._id as Types.ObjectId)?.toString?.() ?? ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Specialization = model<ISpecialization>('Specialization', specializationSchema);

