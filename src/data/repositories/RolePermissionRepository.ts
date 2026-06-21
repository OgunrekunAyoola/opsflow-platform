import type { Model } from 'mongoose';
import type { PermissionGrant } from '@opsflow/contracts';
import type { IRolePermission } from '../../models/RolePermission';
import { BaseRepository } from './BaseRepository';

/**
 * RolePermission repo (RBAC G1) — resolves the effective grants for a role.
 *
 * Tenant-level shadowing: if a tenant has ANY rows for a roleKey, those REPLACE the
 * platform-wide defaults for that role (so a tenant can add or narrow); otherwise the
 * platform-wide defaults (tenantId null) apply. Grants are positive-only (no deny rows).
 *
 * Platform-wide rows have tenantId null, so this repo queries the model directly rather
 * than via BaseRepository's tenant-scoped helpers.
 */
export class RolePermissionRepository extends BaseRepository<IRolePermission> {
  constructor(model: Model<IRolePermission>) {
    super(model, 'role_permissions');
  }

  async grantsForRole(tenantId: string, roleKey: string): Promise<PermissionGrant[]> {
    const tenantRows = (await (this.model as any)
      .find({ tenantId: this.toObjectId(tenantId), roleKey })
      .lean()) as IRolePermission[];
    const rows =
      tenantRows.length > 0
        ? tenantRows
        : ((await (this.model as any).find({ tenantId: null, roleKey }).lean()) as IRolePermission[]);
    return rows.map((r) => ({
      resource: r.resource as PermissionGrant['resource'],
      action: r.action as PermissionGrant['action'],
      resourceId: r.resourceId ?? null,
    }));
  }

  /** Idempotent upsert of a platform-wide default grant (used by seeding). */
  async upsertDefaultGrant(
    roleKey: string,
    resource: string,
    action: string,
    resourceId: string | null = null,
  ): Promise<void> {
    await (this.model as any).updateOne(
      { tenantId: null, roleKey, resource, action, resourceId },
      { $set: { tenantId: null, roleKey, resource, action, resourceId } },
      { upsert: true },
    );
  }
}
