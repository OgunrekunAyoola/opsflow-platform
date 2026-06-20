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
