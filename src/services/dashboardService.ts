import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { parseDhakaDateRange } from '../utils/date.js';
import type {
  DashboardDateRangeInput,
  AdmissionsQueryInput,
} from '../validators/dashboardValidator.js';

export class DashboardService {
  /**
   * Helper to get current calendar date string (YYYY-MM-DD) in Asia/Dhaka time.
   */
  private static getTodayDhaka(): string {
    const now = new Date();
    // Dhaka is UTC+6
    const dhakaTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    return dhakaTime.toISOString().split('T')[0];
  }

  /**
   * Helper to offset a YYYY-MM-DD date by N days.
   */
  private static offsetDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().split('T')[0];
  }

  static async getSummary(query: DashboardDateRangeInput) {
    const toStr = query.to || this.getTodayDhaka();
    const fromStr = query.from || this.offsetDays(toStr, -29); // 30-day window

    const { startDate, endDate } = parseDhakaDateRange(fromStr, toStr);
    if (!startDate || !endDate) {
      throw new AppError('Invalid date range', 400, 'VALIDATION_ERROR');
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.round(durationMs / (24 * 60 * 60 * 1000));
    if (durationDays > 366) {
      throw new AppError('Date range cannot exceed 366 days', 400, 'VALIDATION_ERROR', [
        { path: 'from', message: 'Date range cannot exceed 366 days' },
      ]);
    }

    // Previous range of exact same length ending right before current range
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

    const prevToStr = this.offsetDays(fromStr, -1);
    const prevFromStr = this.offsetDays(prevToStr, -durationDays + 1);

    const [
      totalDoctors,
      totalPatients,
      newPatients,
      newPatientsPrevPeriod,
      criticalPatients,
      dischargedPatients,
    ] = await Promise.all([
      Doctor.countDocuments(),
      Patient.countDocuments(),
      Patient.countDocuments({ admissionDate: { $gte: startDate, $lte: endDate } }),
      Patient.countDocuments({ admissionDate: { $gte: prevStartDate, $lte: prevEndDate } }),
      Patient.countDocuments({ condition: 'critical' }),
      Patient.countDocuments({ condition: 'discharged' }),
    ]);

    let changePct: number | undefined;
    if (newPatientsPrevPeriod > 0) {
      changePct = Math.round(((newPatients - newPatientsPrevPeriod) / newPatientsPrevPeriod) * 1000) / 10;
    }

    const avgPatientsPerDoctor =
      totalDoctors > 0 ? Math.round((totalPatients / totalDoctors) * 10) / 10 : 0;

    return {
      range: { from: fromStr, to: toStr },
      previousRange: { from: prevFromStr, to: prevToStr },
      totalDoctors,
      totalPatients,
      newPatients,
      newPatientsPrevPeriod,
      ...(changePct !== undefined && { changePct }),
      avgPatientsPerDoctor,
      criticalPatients,
      dischargedPatients,
    };
  }

  static async getAdmissions(query: AdmissionsQueryInput) {
    const toStr = query.to || this.getTodayDhaka();
    const fromStr = query.from || this.offsetDays(toStr, -29);

    const { startDate, endDate } = parseDhakaDateRange(fromStr, toStr);
    if (!startDate || !endDate) {
      throw new AppError('Invalid date range', 400, 'VALIDATION_ERROR');
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.round(durationMs / (24 * 60 * 60 * 1000));
    if (durationDays > 366) {
      throw new AppError('Date range cannot exceed 366 days', 400, 'VALIDATION_ERROR');
    }

    let interval = query.interval;
    if (!interval) {
      if (durationDays <= 31) interval = 'day';
      else if (durationDays <= 183) interval = 'week';
      else interval = 'month';
    }

    // Previous range
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

    // Fetch admissions in current and previous periods
    const [currentPatients, prevPatients] = await Promise.all([
      Patient.find({ admissionDate: { $gte: startDate, $lte: endDate } })
        .select('admissionDate')
        .lean(),
      Patient.find({ admissionDate: { $gte: prevStartDate, $lte: prevEndDate } })
        .select('admissionDate')
        .lean(),
    ]);

    // Build day buckets map
    const formatBucket = (d: Date): string => {
      return d.toISOString().split('T')[0];
    };

    const currentMap = new Map<string, number>();
    for (const p of currentPatients) {
      const key = formatBucket(p.admissionDate);
      currentMap.set(key, (currentMap.get(key) || 0) + 1);
    }

    const prevMap = new Map<string, number>();
    for (const p of prevPatients) {
      const key = formatBucket(p.admissionDate);
      prevMap.set(key, (prevMap.get(key) || 0) + 1);
    }

    // Generate buckets ensuring empty days are 0, never missing
    const currentList: { date: string; count: number }[] = [];
    const prevList: { date: string; count: number }[] = [];

    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dateKey = cur.toISOString().split('T')[0];
      currentList.push({
        date: dateKey,
        count: currentMap.get(dateKey) || 0,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const pCur = new Date(prevStartDate);
    while (pCur <= prevEndDate) {
      const dateKey = pCur.toISOString().split('T')[0];
      prevList.push({
        date: dateKey,
        count: prevMap.get(dateKey) || 0,
      });
      pCur.setUTCDate(pCur.getUTCDate() + 1);
    }

    return {
      interval,
      current: currentList,
      previous: prevList,
    };
  }

  static async getPatientsPerDoctor(limit = 10) {
    const doctors = await Doctor.find()
      .sort({ patientCount: -1, _id: -1 })
      .limit(limit)
      .select('_id name specialization patientCount')
      .lean();

    return doctors.map((d: any) => ({
      doctorId: d._id.toString(),
      name: d.name,
      specialization: d.specialization,
      count: d.patientCount,
    }));
  }

  static async getBreakdown() {
    const conditions = ['stable', 'under_observation', 'critical', 'recovering', 'discharged'];

    const [conditionAgg, bySpecialization] = await Promise.all([
      Patient.aggregate([
        { $group: { _id: '$condition', count: { $sum: 1 } } },
      ]),
      Doctor.aggregate([
        {
          $group: {
            _id: '$specialization',
            doctors: { $sum: 1 },
            patients: { $sum: '$patientCount' },
          },
        },
        {
          $project: {
            _id: 0,
            specialization: '$_id',
            doctors: 1,
            patients: 1,
          },
        },
        { $sort: { patients: -1, specialization: 1 } },
      ]),
    ]);

    const countMap = new Map(conditionAgg.map((r: any) => [r._id, r.count]));
    const byCondition = conditions.map((c) => ({
      condition: c,
      count: countMap.get(c) || 0,
    }));

    return {
      byCondition,
      bySpecialization,
    };
  }

  static async getStats() {
    const [totalDoctors, totalPatients, totalUsers] = await Promise.all([
      Doctor.countDocuments(),
      Patient.countDocuments(),
      User.countDocuments(),
    ]);

    const specialtyDistribution = await Doctor.aggregate([
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $project: { specialty: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
    ]);

    const genderDistribution = await Patient.aggregate([
      { $group: { _id: '$gender', count: { $sum: 1 } } },
      { $project: { gender: '$_id', count: 1, _id: 0 } },
    ]);

    return {
      overview: {
        totalDoctors,
        totalPatients,
        totalUsers,
      },
      specialtyDistribution,
      genderDistribution,
    };
  }
}
