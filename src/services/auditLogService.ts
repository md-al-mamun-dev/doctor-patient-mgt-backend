import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { parseDhakaDateRange } from '../utils/date.js';
import type { AuditLogQueryInput } from '../validators/auditLogValidator.js';

export class AuditLogService {
  static async getLogs(query: AuditLogQueryInput) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(Math.max(1, query.limit || 10), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query.actorId) {
      filter.actorId = new Types.ObjectId(query.actorId);
    }
    if (query.action) {
      filter.action = query.action.trim();
    }
    if (query.entityType) {
      filter.entityType = query.entityType.trim();
    }
    if (query.entityId) {
      filter.entityId = new Types.ObjectId(query.entityId);
    }

    if (query.from || query.to) {
      const { startDate, endDate } = parseDhakaDateRange(query.from, query.to);
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      filter.at = dateFilter;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ at: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    // Batch resolve actor names to avoid N+1 queries
    const actorIds = Array.from(
      new Set(logs.map((l) => l.actorId?.toString()).filter(Boolean))
    );
    const actorObjectIds = actorIds.map((id) => new Types.ObjectId(id));
    const users = await User.find({ _id: { $in: actorObjectIds } })
      .select('_id name')
      .lean();
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u.name]));

    const formattedLogs = logs.map((log: any) => ({
      id: log._id.toString(),
      at: log.at,
      actor: log.actorId
        ? {
            id: log.actorId.toString(),
            name: userMap.get(log.actorId.toString()) || 'Unknown User',
          }
        : null,
      action: log.action,
      entityType: log.entityType || null,
      entityId: log.entityId ? log.entityId.toString() : null,
      fields: log.fields || [],
      ip: log.ip || null,
      userAgent: log.userAgent || null,
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      logs: formattedLogs,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
    };
  }
}
