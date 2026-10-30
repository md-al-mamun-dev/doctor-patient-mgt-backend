import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import { User } from '../models/User.js';

export class DashboardService {
  static async getStats() {
    const [totalDoctors, totalPatients, totalUsers] = await Promise.all([
      Doctor.countDocuments(),
      Patient.countDocuments(),
      User.countDocuments(),
    ]);

    const specialtyDistribution = await Doctor.aggregate([
      { $group: { _id: '$specialty', count: { $sum: 1 } } },
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

