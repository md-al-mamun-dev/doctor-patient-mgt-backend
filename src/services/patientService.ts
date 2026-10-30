import { Patient, type IPatient } from '../models/Patient.js';
import { Doctor } from '../models/Doctor.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/logger.js';
import { getPagination } from '../utils/pagination.js';
import type { CreatePatientInput, UpdatePatientInput, PatientQueryInput } from '../validators/patientValidator.js';

export class PatientService {
  static async createPatient(input: CreatePatientInput): Promise<IPatient> {
    const user = await User.findById(input.userId);
    if (!user) {
      throw new AppError('Associated user not found', 404);
    }

    if (input.doctorId) {
      const doctor = await Doctor.findById(input.doctorId);
      if (!doctor) {
        throw new AppError('Assigned doctor not found', 404);
      }
    }

    const existingPatient = await Patient.findOne({ userId: input.userId });
    if (existingPatient) {
      throw new AppError('Patient record already exists for this user', 409);
    }

    return Patient.create(input);
  }

  static async getPatients(query: PatientQueryInput) {
    const { skip, limit, page } = getPagination({
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 10,
    });

    const filter: Record<string, unknown> = {};
    if (query.doctorId) {
      filter.doctorId = query.doctorId;
    }
    if (query.gender) {
      filter.gender = query.gender;
    }

    const [patients, total] = await Promise.all([
      Patient.find(filter)
        .populate('userId', 'name email role')
        .populate({
          path: 'doctorId',
          populate: { path: 'userId', select: 'name email' },
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Patient.countDocuments(filter),
    ]);

    return {
      patients,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPatientById(id: string): Promise<IPatient> {
    const patient = await Patient.findById(id)
      .populate('userId', 'name email role')
      .populate({
        path: 'doctorId',
        populate: { path: 'userId', select: 'name email' },
      })
      .lean();

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }
    return patient as unknown as IPatient;
  }

  static async updatePatient(id: string, input: UpdatePatientInput): Promise<IPatient> {
    if (input.doctorId) {
      const doctor = await Doctor.findById(input.doctorId);
      if (!doctor) {
        throw new AppError('Assigned doctor not found', 404);
      }
    }

    const patient = await Patient.findByIdAndUpdate(id, input, { new: true, runValidators: true });
    if (!patient) {
      throw new AppError('Patient not found', 404);
    }
    return patient;
  }

  static async deletePatient(id: string): Promise<void> {
    const patient = await Patient.findByIdAndDelete(id);
    if (!patient) {
      throw new AppError('Patient not found', 404);
    }
  }
}

