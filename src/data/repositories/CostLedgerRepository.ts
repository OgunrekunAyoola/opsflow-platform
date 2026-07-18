import type { Model } from 'mongoose';
import type { ICostLedger } from '../../models/CostLedger';
import { BaseRepository } from './BaseRepository';

export class CostLedgerRepository extends BaseRepository<ICostLedger> {
  constructor(model: Model<ICostLedger>) {
    super(model, 'cost_ledger');
  }

  /** Append a cost entry for a completed LLM call. Returns the created document. */
  async record(tenantId: string, data: Omit<Partial<ICostLedger>, 'tenantId'>): Promise<ICostLedger> {
    return this.create(tenantId, data as any);
  }

  /**
   * Aggregate total LLM spend for a tenant on a given date (YYYY-MM-DD).
   * CostTrackingService.getDailySpend() MongoDB fallback when Redis is unavailable.
   */
  async aggregateDailyTotal(tenantId: string, date: string): Promise<number> {
    const result = await (this.model as any).aggregate([
      { $match: { tenantId: this.toObjectId(tenantId), date } },
      { $group: { _id: null, total: { $sum: '$llmCostUsd' } } },
    ]);
    return result[0]?.total ?? 0;
  }

  /**
   * Fleet-wide total LLM spend across ALL tenants on a given date (YYYY-MM-DD).
   * SANCTIONED CROSS-TENANT READ (ADR-002): a founder-safety aggregate with no
   * tenantId filter, on par with `tenantRepository.listForOps`. It has no session-
   * authed caller — only the global spend circuit-breaker (CostTrackingService
   * .getGlobalDailySpend) reads it, as the Redis-down fallback for the fleet counter.
   */
  async aggregateGlobalDailyTotal(date: string): Promise<number> {
    const result = await (this.model as any).aggregate([
      { $match: { date } },
      { $group: { _id: null, total: { $sum: '$llmCostUsd' } } },
    ]);
    return result[0]?.total ?? 0;
  }
}
