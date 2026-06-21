import type { Document, Types } from 'mongoose';

/**
 * RolePermission (RBAC G1) — a grant: role `roleKey` may perform (resource, action) on
 * resourceId. Platform-wide defaults have tenantId null (seeded from DEFAULT_ROLE_GRANTS);
 * a tenant's own rows for a roleKey SHADOW the defaults wholesale (role-level override), so
 * a tenant can both add and narrow a role's grants. `resourceId` null = any instance.
 *
 * '*' is allowed for resource/action (superuser wildcard — see DEFAULT_ROLE_GRANTS.admin).
 */
export interface IRolePermission extends Document {
  tenantId: Types.ObjectId | null; // null = platform-wide default
  roleKey: string;
  resource: string;
  action: string;
  resourceId: string | null;
}

export function buildRolePermissionSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const RolePermissionSchema = new Schema<IRolePermission>(
    {
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
      roleKey: { type: String, required: true },
      resource: { type: String, required: true },
      action: { type: String, required: true },
      resourceId: { type: String, default: null },
    },
    { timestamps: true },
  );
  RolePermissionSchema.index({ tenantId: 1, roleKey: 1 });
  // A grant triple is unique within a scope (idempotent seeding).
  RolePermissionSchema.index(
    { tenantId: 1, roleKey: 1, resource: 1, action: 1, resourceId: 1 },
    { unique: true },
  );
  return RolePermissionSchema;
}
