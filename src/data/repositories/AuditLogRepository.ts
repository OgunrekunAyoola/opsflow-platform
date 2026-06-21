import type { Model } from 'mongoose';
import type { IAuditLog, AuditActor } from '../../models/AuditLog';
import { BaseRepository } from './BaseRepository';
import { metrics } from '../../observability/MetricsService';

/**
 * AuditLogRepository — append-only (ADR-032). update/delete intentionally disabled.
 */
export class AuditLogRepository extends BaseRepository<IAuditLog> {
  constructor(model: Model<IAuditLog>) {
    super(model, 'auditlogs', false);
  }

  /** Append a new audit record. The only write path for AuditLog. */
  async append(params: {
    tenantId: string;
    ticketId?: string;
    actor: AuditActor;
    actorId?: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<IAuditLog> {
    const start = Date.now();
    try {
      const doc = await (this.model as any).create({
        tenantId: this.toObjectId(params.tenantId),
        ticketId: params.ticketId ? this.toObjectId(params.ticketId) : undefined,
        actor: params.actor,
        actorId: params.actorId,
        action: params.action,
        metadata: params.metadata,
      });
      return doc.toObject() as IAuditLog;
    } finally {
      metrics.observe('db_query_duration_ms', Date.now() - start, {
        collection: 'auditlogs',
        operation: 'append',
        tenant_id: params.tenantId,
      });
    }
  }

  /** Find recent audit events for a ticket. */
  async findForTicket(tenantId: string, ticketId: string, limit = 50): Promise<IAuditLog[]> {
    const start = Date.now();
    try {
      return (await (this.model as any)
        .find({ tenantId: this.toObjectId(tenantId), ticketId: this.toObjectId(ticketId) })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()) as IAuditLog[];
    } finally {
      metrics.observe('db_query_duration_ms', Date.now() - start, {
        collection: 'auditlogs',
        operation: 'findForTicket',
        tenant_id: tenantId,
      });
    }
  }

  /**
   * Aggregate captured product-interest (the soft-no demand log): top requested terms
   * by frequency + recency, plus the total number of captured interests.
   */
  async aggregateProductInterest(
    tenantId: string,
    limit = 50,
  ): Promise<{ total: number; items: Array<{ term: string; count: number; lastAt: Date }> }> {
    const start = Date.now();
    const match = { tenantId: this.toObjectId(tenantId), action: 'product_interest_captured' };
    try {
      const [total, grouped] = await Promise.all([
        (this.model as any).countDocuments(match),
        (this.model as any).aggregate([
          { $match: match },
          { $unwind: '$metadata.requestedTerms' },
          {
            $group: {
              _id: { $toLower: '$metadata.requestedTerms' },
              count: { $sum: 1 },
              lastAt: { $max: '$createdAt' },
            },
          },
          { $sort: { count: -1, lastAt: -1 } },
          { $limit: limit },
        ]),
      ]);
      return {
        total,
        items: (grouped as any[]).map((g) => ({ term: g._id, count: g.count, lastAt: g.lastAt })),
      };
    } finally {
      metrics.observe('db_query_duration_ms', Date.now() - start, {
        collection: 'auditlogs',
        operation: 'aggregateProductInterest',
        tenant_id: tenantId,
      });
    }
  }

  // Disable mutations — AuditLog is append-only (ADR-032)
  override async updateById(): Promise<never> {
    throw new Error('AuditLog records are immutable (ADR-032)');
  }
  override async deleteById(): Promise<never> {
    throw new Error('AuditLog records are immutable (ADR-032)');
  }
}
