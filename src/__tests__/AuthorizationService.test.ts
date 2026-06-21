/**
 * AuthorizationService (RBAC G1) — deterministic permission brain. The RolePermissionRepository
 * is mocked to return fixed grants; we assert wildcard-or-specific matching + reason codes.
 */
import { AuthorizationService } from '../auth/AuthorizationService';
import type { PermissionGrant } from '@opsflow/contracts';
import { DEFAULT_ROLE_GRANTS } from '@opsflow/contracts';

function serviceWithGrants(grants: PermissionGrant[]) {
  const repo = { grantsForRole: jest.fn().mockResolvedValue(grants) } as any;
  return { svc: new AuthorizationService(repo), repo };
}

const TENANT = 'aaaaaaaaaaaaaaaaaaaaaaaa';

describe('AuthorizationService', () => {
  it('admin wildcard grant authorizes any resource/action', async () => {
    const { svc } = serviceWithGrants([...DEFAULT_ROLE_GRANTS.admin]);
    for (const [resource, action] of [
      ['settings', 'write'],
      ['billing', 'manage'],
      ['ticket', 'read'],
      ['approval', 'decide'],
    ]) {
      const d = await svc.authorize({ tenantId: TENANT, roleKey: 'admin', resource, action });
      expect(d.allowed).toBe(true);
      expect(d.reason).toBe('permission_granted');
    }
  });

  it('support_agent allows ticket read/write but denies settings write', async () => {
    const { svc } = serviceWithGrants([...DEFAULT_ROLE_GRANTS.support_agent]);
    expect(
      (
        await svc.authorize({
          tenantId: TENANT,
          roleKey: 'support_agent',
          resource: 'ticket',
          action: 'read',
        })
      ).allowed,
    ).toBe(true);
    expect(
      (
        await svc.authorize({
          tenantId: TENANT,
          roleKey: 'support_agent',
          resource: 'ticket',
          action: 'write',
        })
      ).allowed,
    ).toBe(true);

    const denied = await svc.authorize({
      tenantId: TENANT,
      roleKey: 'support_agent',
      resource: 'settings',
      action: 'write',
    });
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('missing_permission');
  });

  it('denies approval:decide for support_agent (HITL is privileged)', async () => {
    const { svc } = serviceWithGrants([...DEFAULT_ROLE_GRANTS.support_agent]);
    expect(
      (
        await svc.authorize({
          tenantId: TENANT,
          roleKey: 'support_agent',
          resource: 'approval',
          action: 'decide',
        })
      ).allowed,
    ).toBe(false);
  });

  it('resourceId scoping: a grant for one instance does not authorize another', async () => {
    const { svc } = serviceWithGrants([{ resource: 'agent', action: 'execute', resourceId: 'resolution' }]);
    expect(
      (
        await svc.authorize({
          tenantId: TENANT,
          roleKey: 'r',
          resource: 'agent',
          action: 'execute',
          resourceId: 'resolution',
        })
      ).allowed,
    ).toBe(true);
    expect(
      (
        await svc.authorize({
          tenantId: TENANT,
          roleKey: 'r',
          resource: 'agent',
          action: 'execute',
          resourceId: 'triage',
        })
      ).allowed,
    ).toBe(false);
  });

  it('a null-resourceId grant authorizes any instance', async () => {
    const { svc } = serviceWithGrants([{ resource: 'agent', action: 'execute', resourceId: null }]);
    expect(
      (
        await svc.authorize({
          tenantId: TENANT,
          roleKey: 'r',
          resource: 'agent',
          action: 'execute',
          resourceId: 'anything',
        })
      ).allowed,
    ).toBe(true);
  });

  it('permissionsForRole delegates to the repo', async () => {
    const { svc, repo } = serviceWithGrants([{ resource: 'kb', action: 'read' }]);
    const grants = await svc.permissionsForRole(TENANT, 'support_agent');
    expect(repo.grantsForRole).toHaveBeenCalledWith(TENANT, 'support_agent');
    expect(grants).toEqual([{ resource: 'kb', action: 'read' }]);
  });
});
