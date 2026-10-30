import mongoose, { Types } from 'mongoose';
import { Doctor, type IDoctor } from '../models/Doctor.js';
import { Patient, type IPatient } from '../models/Patient.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/errors.js';
import { formatE164Phone } from '../utils/phone.js';
import { parseDhakaDateRange, parseCalendarDate } from '../utils/date.js';
import { generateSearchTokens } from '../utils/searchTokens.js';
import type {
  CreateDoctorInput,
  UpdateDoctorInput,
  DoctorQueryInput,
  DoctorOptionsQueryInput,
} from '../validators/doctorValidator.js';
import type { CreatePatientInput, PatientQueryInput } from '../validators/patientValidator.js';

export class DoctorService {
  static async getDoctors(query: DoctorQueryInput) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(Math.max(1, query.limit || 10), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    // 1. Specialization filter (supports comma-separated list)
    if (query.specialization) {
      const specs = query.specialization.split(',').map((s) => s.trim()).filter(Boolean);
      if (specs.length === 1) {
        filter.specialization = specs[0];
      } else if (specs.length > 1) {
        filter.specialization = { $in: specs };
      }
    }

    // 2. Hospital filter (supports comma-separated list)
    if (query.hospital) {
      const hospitals = query.hospital.split(',').map((h) => h.trim()).filter(Boolean);
      if (hospitals.length === 1) {
        filter.hospital = hospitals[0];
      } else if (hospitals.length > 1) {
        filter.hospital = { $in: hospitals };
      }
    }

    // 3. Date range filter on createdAt (Asia/Dhaka time)
    if (query.from || query.to) {
      const { startDate, endDate } = parseDhakaDateRange(query.from, query.to);
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      filter.createdAt = dateFilter;
    }

    // 4. Prefix search against indexed searchTokens
    if (query.q) {
      const words = query.q
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .slice(0, 5)
        .filter(Boolean);

      if (words.length > 0) {
        const regexList = words.map((w) => {
          const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`^${escaped}`);
        });
        filter.searchTokens = { $all: regexList };
      }
    }

    // 5. Sorting
    let sortObj: Record<string, 1 | -1>;
    let useCollation = false;

    switch (query.sort) {
      case 'createdAt':
        sortObj = { createdAt: 1, _id: 1 };
        break;
      case 'name':
        sortObj = { name: 1, _id: 1 };
        useCollation = true;
        break;
      case '-name':
        sortObj = { name: -1, _id: -1 };
        useCollation = true;
        break;
      case '-patientCount':
        sortObj = { patientCount: -1, _id: -1 };
        break;
      case '-createdAt':
      default:
        sortObj = { createdAt: -1, _id: -1 };
        break;
    }

    let doctorQuery = Doctor.find(filter)
      .select('-searchTokens -__v')
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    if (useCollation) {
      doctorQuery = doctorQuery.collation({ locale: 'en', strength: 2 });
    }

    const [doctors, total] = await Promise.all([
      doctorQuery.lean(),
      Doctor.countDocuments(filter),
    ]);

    const formatted = doctors.map((d: any) => {
      const id = d._id ? d._id.toString() : d.id;
      delete d._id;
      return {
        ...d,
        id,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      doctors: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
    };
  }

  static async createDoctor(
    input: CreateDoctorInput,
    actorId: string,
    ip?: string,
    userAgent?: string
  ): Promise<IDoctor> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const existing = await Doctor.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      throw new AppError('A doctor with this email already exists', 409, 'CONFLICT', [
        { path: 'email', message: 'Email is already registered' },
      ]);
    }

    const phone = formatE164Phone(input.phone);

    const doctor = await Doctor.create({
      name: input.name.trim(),
      specialization: input.specialization.trim(),
      hospital: input.hospital.trim(),
      phone,
      email: normalizedEmail,
      patientCount: 0,
      version: 1,
      createdBy: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : undefined,
    });

    await AuditLog.create({
      action: 'doctor.create',
      actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
      entityType: 'doctor',
      entityId: doctor._id,
      fields: ['name', 'specialization', 'hospital', 'phone', 'email'],
      ip,
      userAgent,
    });

    return doctor;
  }

  static async getDoctorOptions(query: DoctorOptionsQueryInput) {
    const filter: Record<string, any> = {};

    if (query.q) {
      const words = query.q
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .slice(0, 5)
        .filter(Boolean);

      if (words.length > 0) {
        const regexList = words.map((w) => {
          const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`^${escaped}`);
        });
        filter.searchTokens = { $all: regexList };
      }
    }

    const options = await Doctor.find(filter)
      .select('_id name specialization')
      .sort({ name: 1, _id: 1 })
      .collation({ locale: 'en', strength: 2 })
      .limit(20)
      .lean();

    return options.map((d: any) => ({
      id: d._id.toString(),
      name: d.name,
      specialization: d.specialization,
    }));
  }

  static async getDoctorFacets() {
    const [specializations, hospitals] = await Promise.all([
      Doctor.distinct('specialization'),
      Doctor.distinct('hospital'),
    ]);

    const cleanSpecs = specializations
      .filter((s): s is string => typeof s === 'string' && Boolean(s.trim()))
      .sort((a, b) => a.localeCompare(b));

    const cleanHospitals = hospitals
      .filter((h): h is string => typeof h === 'string' && Boolean(h.trim()))
      .sort((a, b) => a.localeCompare(b));

    return {
      specializations: cleanSpecs,
      hospitals: cleanHospitals,
    };
  }

  static async getDoctorById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    const doctor = await Doctor.findById(id).select('-searchTokens -__v').lean();
    if (!doctor) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    const formattedId = doctor._id ? doctor._id.toString() : (doctor as any).id;
    delete (doctor as any)._id;

    return {
      ...(doctor as any),
      id: formattedId,
    };
  }

  static async updateDoctor(
    id: string,
    input: UpdateDoctorInput,
    expectedVersion: number,
    actorId: string,
    ip?: string,
    userAgent?: string
  ): Promise<IDoctor> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    const doctor = await Doctor.findById(id);
    if (!doctor) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    // Optimistic concurrency check
    if (doctor.version !== expectedVersion) {
      throw new AppError(
        'Precondition failed: resource has been modified',
        412,
        'PRECONDITION_FAILED',
        undefined,
        doctor.toJSON()
      );
    }

    // Email uniqueness check if changing email
    if (input.email && input.email.toLowerCase().trim() !== doctor.email) {
      const existing = await Doctor.findOne({ email: input.email.toLowerCase().trim() }).lean();
      if (existing) {
        throw new AppError('A doctor with this email already exists', 409, 'CONFLICT', [
          { path: 'email', message: 'Email is already registered' },
        ]);
      }
    }

    const phone = input.phone ? formatE164Phone(input.phone) : undefined;
    const isRenaming = input.name !== undefined && input.name.trim() !== doctor.name;

    // When renaming, update doctor and all their patients in a single transaction
    if (isRenaming) {
      const newName = input.name!.trim();
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const updateFields: Record<string, any> = {
          ...input,
          name: newName,
          ...(phone && { phone }),
          searchTokens: generateSearchTokens([
            newName,
            input.specialization || doctor.specialization,
            input.hospital || doctor.hospital,
            input.email || doctor.email,
            phone || doctor.phone,
          ]),
        };

        const updated = await Doctor.findOneAndUpdate(
          { _id: doctor._id, version: expectedVersion },
          {
            $set: updateFields,
            $inc: { version: 1 },
          },
          { session, returnDocument: 'after', runValidators: true }
        );

        if (!updated) {
          throw new AppError('Precondition failed: resource has been modified', 412, 'PRECONDITION_FAILED');
        }

        // Extended reference pattern: synchronize doctorName across all patients of this doctor
        await Patient.updateMany(
          { doctorId: doctor._id },
          { $set: { doctorName: newName } },
          { session }
        );

        await session.commitTransaction();

        await AuditLog.create({
          action: 'doctor.update',
          actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
          entityType: 'doctor',
          entityId: doctor._id,
          fields: Object.keys(input),
          ip,
          userAgent,
        });

        return updated;
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        await session.endSession();
      }
    }

    // Normal update without renaming (atomic findOneAndUpdate)
    const updateFields: Record<string, any> = { ...input };
    if (phone) updateFields.phone = phone;
    if (input.name) updateFields.name = input.name.trim();

    if (input.specialization || input.hospital || input.email || phone) {
      updateFields.searchTokens = generateSearchTokens([
        doctor.name,
        input.specialization || doctor.specialization,
        input.hospital || doctor.hospital,
        input.email || doctor.email,
        phone || doctor.phone,
      ]);
    }

    const updatedDoctor = await Doctor.findOneAndUpdate(
      { _id: doctor._id, version: expectedVersion },
      {
        $set: updateFields,
        $inc: { version: 1 },
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedDoctor) {
      const current = await Doctor.findById(id);
      if (!current) throw new AppError('Doctor not found', 404, 'NOT_FOUND');
      throw new AppError(
        'Precondition failed: resource has been modified',
        412,
        'PRECONDITION_FAILED',
        undefined,
        current.toJSON()
      );
    }

    await AuditLog.create({
      action: 'doctor.update',
      actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
      entityType: 'doctor',
      entityId: doctor._id,
      fields: Object.keys(input),
      ip,
      userAgent,
    });

    return updatedDoctor;
  }

  static async getDoctorSummary(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    const doctor = await Doctor.findById(id).lean();
    if (!doctor) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    // 1. Condition Breakdown aggregation
    const conditionAgg = await Patient.aggregate([
      { $match: { doctorId: doctor._id } },
      { $group: { _id: '$condition', count: { $sum: 1 } } },
    ]);

    const byCondition: Record<string, number> = {
      stable: 0,
      under_observation: 0,
      critical: 0,
      recovering: 0,
      discharged: 0,
    };

    for (const row of conditionAgg) {
      if (row._id in byCondition) {
        byCondition[row._id] = row.count;
      }
    }

    // 2. Admitted this month in Asia/Dhaka time
    const now = new Date();
    const dhakaYear = now.getUTCFullYear();
    const dhakaMonth = now.getUTCMonth();
    // UTC date corresponding to 1st of month 00:00:00 Asia/Dhaka (UTC+6)
    const monthStartDhaka = new Date(Date.UTC(dhakaYear, dhakaMonth, 1, 0 - 6, 0, 0, 0));

    const admittedThisMonth = await Patient.countDocuments({
      doctorId: doctor._id,
      admissionDate: { $gte: monthStartDhaka },
    });

    // 3. Last admission date
    const latestPatient = await Patient.findOne({ doctorId: doctor._id })
      .sort({ admissionDate: -1, _id: -1 })
      .select('admissionDate')
      .lean();

    let lastAdmissionDate: string | null = null;
    if (latestPatient?.admissionDate) {
      lastAdmissionDate =
        latestPatient.admissionDate instanceof Date
          ? latestPatient.admissionDate.toISOString().split('T')[0]
          : String(latestPatient.admissionDate).split('T')[0];
    }

    return {
      patientCount: doctor.patientCount,
      byCondition,
      admittedThisMonth,
      lastAdmissionDate,
    };
  }

  static async getDoctorPatients(doctorId: string, query: PatientQueryInput) {
    if (!Types.ObjectId.isValid(doctorId)) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    const doctor = await Doctor.findById(doctorId).lean();
    if (!doctor) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(Math.max(1, query.limit || 10), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { doctorId: doctor._id };

    if (query.condition) {
      const conditions = query.condition.split(',').map((c) => c.trim()).filter(Boolean);
      if (conditions.length === 1) {
        filter.condition = conditions[0];
      } else if (conditions.length > 1) {
        filter.condition = { $in: conditions };
      }
    }

    if (query.from || query.to) {
      const { startDate, endDate } = parseDhakaDateRange(query.from, query.to);
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      filter.admissionDate = dateFilter;
    }

    if (query.q) {
      const words = query.q
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .slice(0, 5)
        .filter(Boolean);

      if (words.length > 0) {
        const regexList = words.map((w) => {
          const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`^${escaped}`);
        });
        filter.searchTokens = { $all: regexList };
      }
    }

    let sortObj: Record<string, 1 | -1>;
    let useCollation = false;

    switch (query.sort) {
      case 'admissionDate':
        sortObj = { admissionDate: 1, _id: 1 };
        break;
      case 'name':
        sortObj = { name: 1, _id: 1 };
        useCollation = true;
        break;
      case '-admissionDate':
      default:
        sortObj = { admissionDate: -1, _id: -1 };
        break;
    }

    let pQuery = Patient.find(filter)
      .select('-notes -searchTokens -__v')
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    if (useCollation) {
      pQuery = pQuery.collation({ locale: 'en', strength: 2 });
    }

    const [patients, total] = await Promise.all([
      pQuery.lean(),
      Patient.countDocuments(filter),
    ]);

    const formatted = patients.map((p: any) => {
      const id = p._id ? p._id.toString() : p.id;
      delete p._id;
      if (p.admissionDate instanceof Date) {
        p.admissionDate = p.admissionDate.toISOString().split('T')[0];
      } else if (typeof p.admissionDate === 'string' && p.admissionDate.includes('T')) {
        p.admissionDate = p.admissionDate.split('T')[0];
      }
      return {
        ...p,
        id,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      patients: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
    };
  }

  static async createDoctorPatient(
    doctorId: string,
    input: CreatePatientInput,
    actorId: string,
    ip?: string,
    userAgent?: string
  ): Promise<IPatient> {
    if (!Types.ObjectId.isValid(doctorId)) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    const phone = formatE164Phone(input.phone);
    const admissionDate = parseCalendarDate(input.admissionDate);

    // Atomic multi-document transaction creating patient and incrementing doctor patientCount
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [patient] = await Patient.create(
        [
          {
            name: input.name.trim(),
            age: input.age,
            gender: input.gender,
            phone,
            email: input.email ? input.email.toLowerCase().trim() : undefined,
            condition: input.condition,
            diagnosis: input.diagnosis ? input.diagnosis.trim() : undefined,
            admissionDate,
            notes: input.notes ? input.notes.trim() : undefined,
            doctorId: doctor._id,
            doctorName: doctor.name,
            version: 1,
            createdBy: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : undefined,
          },
        ],
        { session }
      );

      await Doctor.findByIdAndUpdate(
        doctor._id,
        { $inc: { patientCount: 1 } },
        { session }
      );

      await session.commitTransaction();

      await AuditLog.create({
        action: 'patient.create',
        actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
        entityType: 'patient',
        entityId: patient._id,
        fields: ['name', 'age', 'gender', 'phone', 'condition', 'admissionDate', 'doctorId'],
        ip,
        userAgent,
      });

      return patient;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
