import { Doctor, type IDoctor } from '../models/Doctor.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/logger.js';
import { getPagination } from '../utils/pagination.js';
import type { CreateDoctorInput, UpdateDoctorInput, DoctorQueryInput } from '../validators/doctorValidator.js';

export class DoctorService {
  static async createDoctor(input: CreateDoctorInput): Promise<IDoctor> {
    const user = await User.findById(input.userId);
    if (!user) {
      throw new AppError('Associated user not found', 404);
    }

    const existingDoc = await Doctor.findOne({ userId: input.userId });
    if (existingDoc) {
      throw new AppError('Doctor profile already exists for this user', 409);
    }

    return Doctor.create(input);
  }

  static async getDoctors(query: DoctorQueryInput) {
    const { skip, limit, page } = getPagination({
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 10,
    });

    const filter: Record<string, unknown> = {};
    if (query.specialty) {
      filter.specialty = { $regex: query.specialty, $options: 'i' };
    }
    if (query.department) {
      filter.department = { $regex: query.department, $options: 'i' };
    }

    const [doctors, total] = await Promise.all([
      Doctor.find(filter)
        .populate('userId', 'name email role')
        .skip(skip)
        .limit(limit)
        .lean(),
      Doctor.countDocuments(filter),
    ]);

    return {
      doctors,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getDoctorById(id: string): Promise<IDoctor> {
    const doctor = await Doctor.findById(id).populate('userId', 'name email role').lean();
    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }
    return doctor as unknown as IDoctor;
  }

  static async updateDoctor(id: string, input: UpdateDoctorInput): Promise<IDoctor> {
    const doctor = await Doctor.findByIdAndUpdate(id, input, { new: true, runValidators: true });
    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }
    return doctor;
  }

  static async deleteDoctor(id: string): Promise<void> {
    const doctor = await Doctor.findByIdAndDelete(id);
    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }
  }
}

