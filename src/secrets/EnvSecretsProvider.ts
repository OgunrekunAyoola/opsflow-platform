import type { SecretsProvider } from './SecretsProvider';
import { SecretNotFoundError } from './SecretsProvider';

// Env-var name conventions (in priority order):
//   OPSFLOW_{SCOPE_UPPER}_{KEY_UPPER}
//   {KEY_UPPER}   ← legacy/plain fallback
//
// Examples:
//   get('agent:TriageAgent', 'apiKey') → OPSFLOW_AGENT_TRIAGEAGENT_APIKEY → APIKEY
//   get('global', 'ANTHROPIC_API_KEY') → OPSFLOW_GLOBAL_ANTHROPIC_API_KEY → ANTHROPIC_API_KEY

function toEnvSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
}

function buildEnvKey(scope: string, key: string): string {
  return `OPSFLOW_${toEnvSegment(scope)}_${toEnvSegment(key)}`;
}

interface CacheEntry {
  value: string;
  expiresAt: number;
}

export class EnvSecretsProvider implements SecretsProvider {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs = 5 * 60 * 1000) {
    // 5-minute TTL default
    this.ttlMs = ttlMs;
  }

  async get(scope: string, key: string): Promise<string> {
    const value = await this.getOptional(scope, key);
    if (value === null) throw new SecretNotFoundError(scope, key);
    return value;
  }

  async getOptional(scope: string, key: string): Promise<string | null> {
    const cacheKey = `${scope}:${key}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    // Resolution order: scoped env var → plain key name → null
    const scoped = process.env[buildEnvKey(scope, key)];
    const plain = process.env[key] ?? process.env[toEnvSegment(key)];
    const value = scoped ?? plain ?? null;

    if (value !== null) {
      this.cache.set(cacheKey, { value, expiresAt: Date.now() + this.ttlMs });
    }
    return value;
  }

  async invalidate(scope: string, key: string): Promise<void> {
    this.cache.delete(`${scope}:${key}`);
  }
}
