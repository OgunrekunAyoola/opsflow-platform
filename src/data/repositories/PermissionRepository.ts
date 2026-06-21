import type { Model } from 'mongoose';
import type { IPermission } from '../../models/Permission';
import { BaseRepository } from './BaseRepository';

/**
 * Permission catalog repo (RBAC G1). The catalog is platform-wide (no tenantId), so this
 * repo uses the model directly rather than BaseRepository's tenant-scoped helpers.
 */
export class PermissionRepository extends BaseRepository<IPermission> {
  constructor(model: Model<IPermission>) {
    super(model, 'permissions');
  }

  async listAll(): Promise<IPermission[]> {
    return (this.model as any).find({}).lean() as Promise<IPermission[]>;
  }

  /** Idempotent upsert of a catalog entry (used by seeding). */
  async upsert(resource: string, action: string, description?: string): Promise<void> {
    await (this.model as any).updateOne(
      { resource, action },
      { $set: { resource, action, description } },
      { upsert: true },
    );
  }
}
