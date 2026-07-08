import type { Model } from 'mongoose';
import type { IIntegrationConnection } from '../../models/IntegrationConnection';
import { BaseRepository } from './BaseRepository';

export class IntegrationConnectionRepository extends BaseRepository<IIntegrationConnection> {
  constructor(model: Model<IIntegrationConnection>) {
    super(model, 'integration_connections', true); // soft-delete enabled
  }

  /** Worker entry point: sync jobs carry only a connectionId; tenant derived from the
   *  returned connection. Subsequent writes are tenant-scoped. */
  async findByIdAnyTenant(connectionId: string): Promise<IIntegrationConnection | null> {
    return (this.model as any)
      .findOne({ _id: this.toObjectId(connectionId), deletedAt: null })
      .lean()
      .exec() as Promise<IIntegrationConnection | null>;
  }

  /** Upsert the tenant's connection for a provider (same findOneAndUpdate the routes used —
   *  preserves the model's update-hook encryption of accessToken). */
  async upsertByProvider(
    tenantId: string,
    provider: string,
    patch: Record<string, unknown>,
  ): Promise<IIntegrationConnection> {
    return (this.model as any).findOneAndUpdate(
      { tenantId: this.toObjectId(tenantId), deletedAt: null, provider },
      patch,
      { upsert: true, new: true },
    ) as Promise<IIntegrationConnection>;
  }

  async setSyncStatus(
    tenantId: string,
    connectionId: string,
    status: 'active' | 'error',
    lastSyncAt?: Date,
  ): Promise<void> {
    const set: Record<string, unknown> = { status };
    if (lastSyncAt) set.lastSyncAt = lastSyncAt;
    await this.updateById(tenantId, connectionId, { $set: set });
  }
}
