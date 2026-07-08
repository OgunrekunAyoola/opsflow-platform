import type { Model, FilterQuery } from 'mongoose';
import type { ITenant } from '../../models/Tenant';
import { BaseRepository } from './BaseRepository';
import { metrics } from '../../observability/MetricsService';

export class TenantRepository extends BaseRepository<ITenant> {
  constructor(model: Model<ITenant>) {
    super(model, 'tenants', true); // soft-delete enabled
  }

  /** Look up a tenant by ID — tenants ARE the top-level isolation boundary (no tenantId filter). */
  async findTenantById(id: string, select?: string): Promise<ITenant | null> {
    const start = Date.now();
    try {
      let q = (this.model as any).findOne({ _id: this.toObjectId(id), deletedAt: null });
      if (select) q = q.select(select);
      return (await q.lean()) as ITenant | null;
    } finally {
      metrics.observe('db_query_duration_ms', Date.now() - start, {
        collection: 'tenants',
        operation: 'findTenantById',
        tenant_id: id,
      });
    }
  }

  async findByInboundAddress(address: string): Promise<ITenant | null> {
    const start = Date.now();
    try {
      return (await (this.model as any)
        .findOne({ inboundAddress: address, deletedAt: null })
        .lean()) as ITenant | null;
    } finally {
      metrics.observe('db_query_duration_ms', Date.now() - start, {
        collection: 'tenants',
        operation: 'findByInboundAddress',
        tenant_id: 'unknown',
      });
    }
  }

  async findByApiKey(apiKey: string): Promise<ITenant | null> {
    const start = Date.now();
    try {
      return (await (this.model as any)
        .findOne({ ingestApiKey: apiKey, deletedAt: null })
        .lean()) as ITenant | null;
    } finally {
      metrics.observe('db_query_duration_ms', Date.now() - start, {
        collection: 'tenants',
        operation: 'findByApiKey',
        tenant_id: 'unknown',
      });
    }
  }

  /** findById/findOne on Tenant are cross-tenant by design — override to drop tenantId filter. */
  override async findById(_tenantId: string, id: string): Promise<ITenant | null> {
    return this.findTenantById(id);
  }

  override async findOne(_tenantId: string, filter: FilterQuery<ITenant>): Promise<ITenant | null> {
    const start = Date.now();
    try {
      return (await (this.model as any).findOne({ ...filter, deletedAt: null }).lean()) as ITenant | null;
    } finally {
      metrics.observe('db_query_duration_ms', Date.now() - start, {
        collection: 'tenants',
        operation: 'findOne',
        tenant_id: 'unknown',
      });
    }
  }

  async findAllActive(): Promise<Array<{ _id: string }>> {
    return (this.model as any).find({ deletedAt: null }).select('_id').lean() as Promise<
      Array<{ _id: string }>
    >;
  }

  /** Bootstrap: create a tenant (signup flow — the one create that precedes any tenantId). */
  async createTenant(data: Record<string, unknown>): Promise<ITenant> {
    const doc = await (this.model as any).create(data);
    return doc.toObject() as ITenant;
  }

  /** Slug uniqueness probe for tenant provisioning. */
  async slugExists(slug: string): Promise<boolean> {
    return Boolean(await (this.model as any).exists({ slug }));
  }

  /** Inbound-email webhook auth: resolve the tenant that owns an inbound secret (pre-auth lookup). */
  async findByInboundSecret(secret: string): Promise<ITenant | null> {
    return (this.model as any)
      .findOne({ inboundSecret: secret, deletedAt: null })
      .lean() as Promise<ITenant | null>;
  }

  /** Verified-WhatsApp tenants (the quality-monitor sweep population). */
  async findWhatsAppVerified(): Promise<Array<{ _id: unknown; whatsapp?: Record<string, unknown> }>> {
    return (this.model as any)
      .find({
        'whatsapp.isVerified': true,
        'whatsapp.phoneNumberId': { $exists: true },
        deletedAt: null,
      })
      .select('_id whatsapp')
      .lean() as Promise<Array<{ _id: unknown; whatsapp?: Record<string, unknown> }>>;
  }

  async incrementTicketsUsed(id: string): Promise<void> {
    await (this.model as any).updateOne(
      { _id: this.toObjectId(id), deletedAt: null },
      { $inc: { ticketsUsedThisCycle: 1 } },
    );
  }

  async updateTenantById(id: string, update: Record<string, unknown>): Promise<void> {
    await (this.model as any).updateOne({ _id: this.toObjectId(id), deletedAt: null }, update);
  }

  /** Cross-tenant query by filter — startup seeds / periodic sweeps. Deliberately unscoped. */
  async findTenants(filter: FilterQuery<ITenant>, projection?: string): Promise<ITenant[]> {
    let q = (this.model as any).find({ ...filter, deletedAt: null });
    if (projection) q = q.select(projection);
    return q.lean() as Promise<ITenant[]>;
  }
}
