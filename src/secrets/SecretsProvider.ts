// Per-agent secret scoping (ADR-075 / Block 5)
// Scope syntax mirrors IAM resource naming — structured for future RBAC enforcement.

export type SecretScope =
  | 'global'                                      // shared across all tenants and agents
  | `agent:${string}`                             // per-agent (e.g. agent:TriageAgent)
  | `tenant:${string}`                            // per-tenant enterprise BYOK
  | `agent:${string}:tenant:${string}`;           // per-agent-per-tenant (most privileged)

export interface SecretsProvider {
  /** Returns the secret value. Throws `SecretNotFoundError` if missing. */
  get(scope: SecretScope | string, key: string): Promise<string>;
  /** Returns null if not found. Caller decides how to handle absence. */
  getOptional(scope: SecretScope | string, key: string): Promise<string | null>;
  /** Invalidate cache entry so the next get() fetches fresh. */
  invalidate(scope: SecretScope | string, key: string): Promise<void>;
}

export class SecretNotFoundError extends Error {
  constructor(scope: string, key: string) {
    super(`Secret not found: scope=${scope} key=${key}`);
    this.name = 'SecretNotFoundError';
  }
}
