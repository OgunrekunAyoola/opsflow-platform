import { grantsAllow, type PermissionGrant } from '@opsflow/contracts';
import type { RolePermissionRepository } from '../data/repositories/RolePermissionRepository';

export interface AuthorizeRequest {
  tenantId: string;
  roleKey: string;
  resource: string;
  action: string;
  resourceId?: string | null;
}

export interface AuthorizeDecision {
  allowed: boolean;
  /** 'permission_granted' | 'missing_permission' — mirrors FinStrat's rbac_decision reason. */
  reason: 'permission_granted' | 'missing_permission';
  grants: PermissionGrant[];
}

/**
 * AuthorizationService (RBAC G1) — the deterministic permission brain. Pure: it decides,
 * it does not audit (each consumer writes the `rbac_decision` audit with its own AuditService,
 * since AuditService is host-side). Resolves the role's effective grants (tenant shadows
 * defaults) then applies wildcard-or-specific matching (grantsAllow).
 *
 * The host constructs it with its registered-model-backed RolePermissionRepository, so the
 * orchestrator turn-owner and the HTTP layer share one authorize implementation.
 */
export class AuthorizationService {
  constructor(private readonly rolePermissions: RolePermissionRepository) {}

  async permissionsForRole(tenantId: string, roleKey: string): Promise<PermissionGrant[]> {
    return this.rolePermissions.grantsForRole(tenantId, roleKey);
  }

  async authorize(req: AuthorizeRequest): Promise<AuthorizeDecision> {
    const grants = await this.permissionsForRole(req.tenantId, req.roleKey);
    const allowed = grantsAllow(grants, req.resource, req.action, req.resourceId ?? null);
    return { allowed, reason: allowed ? 'permission_granted' : 'missing_permission', grants };
  }
}
