import type { Model } from 'mongoose';
import type { IRole } from '../../models/Role';
import { BaseRepository } from './BaseRepository';

/**
 * Role repo (RBAC G1). Roles may be platform-wide (tenantId null) or tenant-scoped, so this
 * repo queries the model directly (BaseRepository's helpers force a tenantId filter, which
 * would hide the platform-wide system roles).
 */
export class RoleRepository extends BaseRepository<IRole> {
  constructor(model: Model<IRole>) {
    super(model, 'roles');
  }

  /** System + this-tenant roles (tenant rows first). */
  async listForTenant(tenantId: string): Promise<IRole[]> {
    return (this.model as any)
      .find({ $or: [{ tenantId: this.toObjectId(tenantId) }, { tenantId: null }] })
      .lean() as Promise<IRole[]>;
  }

  /** Idempotent upsert of a system (platform-wide) role. */
  async upsertSystemRole(key: string, name: string, description?: string): Promise<void> {
    await (this.model as any).updateOne(
      { tenantId: null, key },
      { $set: { tenantId: null, key, name, description, isSystem: true } },
      { upsert: true },
    );
  }
}
