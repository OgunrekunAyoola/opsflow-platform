import type { Document } from 'mongoose';

/**
 * Permission catalog (RBAC G1) — the platform-wide vocabulary of (resource, action) pairs
 * the system understands. Seeded from PERMISSION_CATALOG in @opsflow/contracts. Reference
 * data only (grants live in role_permissions); no tenantId — the catalog is global.
 */
export interface IPermission extends Document {
  resource: string;
  action: string;
  description?: string;
}

export function buildPermissionSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const PermissionSchema = new Schema<IPermission>(
    {
      resource: { type: String, required: true },
      action: { type: String, required: true },
      description: { type: String },
    },
    { timestamps: true },
  );
  PermissionSchema.index({ resource: 1, action: 1 }, { unique: true });
  return PermissionSchema;
}
