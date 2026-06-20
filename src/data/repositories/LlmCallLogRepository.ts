import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import type { ILlmCallLog } from '../../models/LlmCallLog';

interface LogEntry {
  tenantId?: string;
  ticketId?: string;
  task: string;
  modelName: string;
  success: boolean;
  latencyMs: number;
  error?: string;
}

interface TaskMetrics {
  _id: string;
  totalCalls: number;
  successes: number;
  failures: number;
  avgLatencyMs: number;
}

/**
 * Standalone (not BaseRepository) because tenantId is optional on LlmCallLog —
 * the model records infra calls where tenant context may not exist. Tenant-scoped
 * queries still inject tenantId explicitly.
 */
export class LlmCallLogRepository {
  constructor(private readonly model: Model<ILlmCallLog>) {}

  /** Fire-and-forget safe log write. Never throws (callers use .catch). */
  async log(entry: LogEntry): Promise<ILlmCallLog> {
    return (this.model as any).create({
      tenantId: entry.tenantId ? new mongoose.Types.ObjectId(entry.tenantId) : undefined,
      ticketId: entry.ticketId ? new mongoose.Types.ObjectId(entry.ticketId) : undefined,
      task:      entry.task,
      modelName: entry.modelName,
      success:   entry.success,
      latencyMs: entry.latencyMs,
      ...(entry.error ? { errorMessage: entry.error } : {}),
    });
  }

  /** Aggregate call metrics grouped by task for a tenant. `since` filters by createdAt. */
  async aggregateByTask(tenantId: string, since?: Date): Promise<TaskMetrics[]> {
    const match: Record<string, unknown> = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,
    };
    if (since) match.createdAt = { $gte: since };

    return (this.model as any).aggregate([
      { $match: match },
      {
        $group: {
          _id:          '$task',
          totalCalls:   { $sum: 1 },
          successes:    { $sum: { $cond: ['$success', 1, 0] } },
          failures:     { $sum: { $cond: ['$success', 0, 1] } },
          avgLatencyMs: { $avg: '$latencyMs' },
        },
      },
    ]) as Promise<TaskMetrics[]>;
  }
}
