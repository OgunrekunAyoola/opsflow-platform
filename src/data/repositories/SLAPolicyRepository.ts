import type { Model } from 'mongoose';
import type { ISLAPolicy } from '../../models/SLAPolicy';
import { BaseRepository } from './BaseRepository';

export class SLAPolicyRepository extends BaseRepository<ISLAPolicy> {
  constructor(model: Model<ISLAPolicy>) {
    super(model, 'sla_policies', true); // soft-delete enabled
  }

  /** Find the SLA policy matching a customer tier for a tenant. */
  async findByTier(tenantId: string, tier: string): Promise<ISLAPolicy | null> {
    return this.findOne(tenantId, { tier } as any);
  }
}
