import mongoose, { Types } from 'mongoose';
import { Patient, type IPatient } from '../models/Patient.js';
import { Doctor } from '../models/Doctor.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/errors.js';
import { formatE164Phone } from '../utils/phone.js';
import { parseDhakaDateRange, parseCalendarDate } from '../utils/date.js';
import { generateSearchTokens } from '../utils/searchTokens.js';
import type {
  UpdatePatientInput,
  PatientQueryInput,
} from '../validators/patientValidator.js';

export class PatientService {
  static async getPatients(query: PatientQueryInput) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(Math.max(1, query.limit || 10), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    // 1. Doctor ID filter
    if (query.doctorId) {
      if (!Types.ObjectId.isValid(query.doctorId)) {
        throw new AppError('Invalid Doctor ID format', 400, 'VALIDATION_ERROR', [
          { path: 'doctorId', message: 'Enter a valid 24-character hexadecimal ObjectId' },
        ]);
      }
      filter.doctorId = new Types.ObjectId(query.doctorId);
    }

    // 2. Condition filter (supports comma-separated list)
    if (query.condition) {
      const conditions = query.condition.split(',').map((c) => c.trim()).filter(Boolean);
      const validConditions = new Set([
        'stable',
        'under_observation',
        'critical',
        'recovering',
        'discharged',
      ]);
      for (const c of conditions) {
        if (!validConditions.has(c)) {
          throw new AppError(`Invalid condition: "${c}"`, 400, 'VALIDATION_ERROR', [
            { path: 'condition', message: `Invalid condition: ${c}` },
          ]);
        }
      }
      if (conditions.length === 1) {
        filter.condition = conditions[0];
      } else if (conditions.length > 1) {
        filter.condition = { $in: conditions };
      }
    }

    // 3. Date range on admissionDate
    if (query.from || query.to) {
      const { startDate, endDate } = parseDhakaDateRange(query.from, query.to);
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      filter.admissionDate = dateFilter;
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

  static async getPatientById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Patient not found', 404, 'NOT_FOUND');
    }

    const patient = await Patient.findById(id).select('-searchTokens -__v').lean();
    if (!patient) {
      throw new AppError('Patient not found', 404, 'NOT_FOUND');
    }

    const formattedId = patient._id ? patient._id.toString() : (patient as any).id;
    delete (patient as any)._id;

    const rawDate: any = patient.admissionDate;
    let admissionDate: string;
    if (rawDate instanceof Date) {
      admissionDate = rawDate.toISOString().split('T')[0];
    } else if (typeof rawDate === 'string' && rawDate.includes('T')) {
      admissionDate = rawDate.split('T')[0];
    } else {
      admissionDate = String(rawDate || '');
    }

    return {
      ...(patient as any),
      id: formattedId,
      admissionDate,
    };
  }

  static async updatePatient(
    id: string,
    input: UpdatePatientInput,
    expectedVersion: number,
    actorId: string,
    ip?: string,
    userAgent?: string
  ): Promise<IPatient> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Patient not found', 404, 'NOT_FOUND');
    }

    const patient = await Patient.findById(id);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'NOT_FOUND');
    }

    // Optimistic concurrency check
    if (patient.version !== expectedVersion) {
      throw new AppError(
        'Precondition failed: resource has been modified',
        412,
        'PRECONDITION_FAILED',
        undefined,
        patient.toJSON()
      );
    }

    const phone = input.phone ? formatE164Phone(input.phone) : undefined;
    const admissionDate = input.admissionDate ? parseCalendarDate(input.admissionDate) : undefined;

    // Check if reassigning to a new doctor
    const isReassignment =
      input.doctorId !== undefined && input.doctorId !== patient.doctorId.toString();

    if (isReassignment) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const newDoctor = await Doctor.findById(input.doctorId).session(session);
        if (!newDoctor) {
          throw new AppError('Target doctor not found', 404, 'NOT_FOUND');
        }

        // Decrement patientCount on old doctor
        await Doctor.findByIdAndUpdate(
          patient.doctorId,
          { $inc: { patientCount: -1 } },
          { session }
        );

        // Increment patientCount on new doctor
        await Doctor.findByIdAndUpdate(
          newDoctor._id,
          { $inc: { patientCount: 1 } },
          { session }
        );

        const updateFields: Record<string, any> = { ...input };
        updateFields.doctorId = newDoctor._id;
        updateFields.doctorName = newDoctor.name;
        if (phone) updateFields.phone = phone;
        if (admissionDate) updateFields.admissionDate = admissionDate;
        if (input.email) updateFields.email = input.email.toLowerCase().trim();

        if (input.name || input.diagnosis || phone) {
          updateFields.searchTokens = generateSearchTokens([
            input.name || patient.name,
            input.diagnosis || patient.diagnosis,
            phone || patient.phone,
          ]);
        }
        updateFields.updatedBy = Types.ObjectId.isValid(actorId)
          ? new Types.ObjectId(actorId)
          : undefined;

        const updated = await Patient.findOneAndUpdate(
          { _id: patient._id, version: expectedVersion },
          {
            $set: updateFields,
            $inc: { version: 1 },
          },
          { session, returnDocument: 'after', runValidators: true }
        );

        if (!updated) {
          throw new AppError('Precondition failed: resource has been modified', 412, 'PRECONDITION_FAILED');
        }

        await session.commitTransaction();

        await AuditLog.create({
          action: 'patient.update',
          actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
          entityType: 'patient',
          entityId: patient._id,
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

    // Normal update without reassignment
    const updateFields: Record<string, any> = { ...input };
    if (phone) updateFields.phone = phone;
    if (admissionDate) updateFields.admissionDate = admissionDate;
    if (input.email) updateFields.email = input.email.toLowerCase().trim();

    if (input.name || input.diagnosis || phone) {
      updateFields.searchTokens = generateSearchTokens([
        input.name || patient.name,
        input.diagnosis || patient.diagnosis,
        phone || patient.phone,
      ]);
    }
    updateFields.updatedBy = Types.ObjectId.isValid(actorId)
      ? new Types.ObjectId(actorId)
      : undefined;

    const updatedPatient = await Patient.findOneAndUpdate(
      { _id: patient._id, version: expectedVersion },
      {
        $set: updateFields,
        $inc: { version: 1 },
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedPatient) {
      const current = await Patient.findById(id);
      if (!current) throw new AppError('Patient not found', 404, 'NOT_FOUND');
      throw new AppError(
        'Precondition failed: resource has been modified',
        412,
        'PRECONDITION_FAILED',
        undefined,
        current.toJSON()
      );
    }

    await AuditLog.create({
      action: 'patient.update',
      actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
      entityType: 'patient',
      entityId: patient._id,
      fields: Object.keys(input),
      ip,
      userAgent,
    });

    return updatedPatient;
  }

  static async deletePatient(
    id: string,
    actorId: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Patient not found', 404, 'NOT_FOUND');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const patient = await Patient.findById(id).session(session);
      if (!patient) {
        throw new AppError('Patient not found', 404, 'NOT_FOUND');
      }

      await Patient.findByIdAndDelete(patient._id, { session });

      await Doctor.findByIdAndUpdate(
        patient.doctorId,
        { $inc: { patientCount: -1 } },
        { session }
      );

      await session.commitTransaction();

      await AuditLog.create({
        action: 'patient.delete',
        actorId: Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
        entityType: 'patient',
        entityId: patient._id,
        ip,
        userAgent,
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
