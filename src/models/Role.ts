import type { Document, Types } from 'mongoose';

/**
 * Role (RBAC G1) — a named role. System roles (admin, support_agent) are platform-wide
 * (tenantId null, isSystem true); a tenant may define custom roles scoped to its tenantId.
 * The role `key` is what `User.role` stores and what role_permissions grants are keyed by.
 */
export interface IRole extends Document {
  tenantId: Types.ObjectId | null; // null = platform-wide system role
  key: string;
  name: string;
  description?: string;
  isSystem: boolean;
}

export function buildRoleSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const RoleSchema = new Schema<IRole>(
    {
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
      key: { type: String, required: true },
      name: { type: String, required: true },
      description: { type: String },
      isSystem: { type: Boolean, default: false },
    },
    { timestamps: true },
  );
  // One role key per scope (platform-wide rows share tenantId=null).
  RoleSchema.index({ tenantId: 1, key: 1 }, { unique: true });
  return RoleSchema;
}
