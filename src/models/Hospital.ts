import { Schema, model, type Document, type Types } from 'mongoose';

export interface IHospital extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalSchema = new Schema<IHospital>(
  {
    name: {
      type: String,
      required: [true, 'Hospital name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Hospital name must be at least 2 characters'],
      maxlength: [100, 'Hospital name cannot exceed 100 characters'],
    },
  },
  {
    timestamps: true,
  }
);

hospitalSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = (ret._id as Types.ObjectId)?.toString?.() ?? ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Hospital = model<IHospital>('Hospital', hospitalSchema);
