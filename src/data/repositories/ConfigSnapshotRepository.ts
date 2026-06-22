import { createHash } from 'crypto';
import type { Model } from 'mongoose';
import type { IConfigSnapshot } from '../../models/ConfigSnapshot';
import { BaseRepository } from './BaseRepository';

/** Stable JSON (sorted keys, recursively) so key order can't change the content hash. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(',')}}`;
}

export class ConfigSnapshotRepository extends BaseRepository<IConfigSnapshot> {
  constructor(model: Model<IConfigSnapshot>) {
    super(model, 'config_snapshots');
  }

  /**
   * Snapshot the effective config for a run. Content-hash deduplicated: an identical config
   * reuses its existing snapshot (no per-run row). New configs get version = latest + 1.
   * Race-safe via the unique (tenantId, contentHash) index — a concurrent duplicate insert
   * is caught and the existing row is returned.
   */
  async snapshot(
    tenantId: string,
    config: Record<string, unknown>,
  ): Promise<{ snapshotId: string; version: number }> {
    const oid = this.toObjectId(tenantId);
    const contentHash = createHash('sha256').update(stableStringify(config)).digest('hex');

    const existing = (await (this.model as any)
      .findOne({ tenantId: oid, contentHash })
      .lean()) as IConfigSnapshot | null;
    if (existing) {
      return { snapshotId: String((existing as any)._id), version: existing.version };
    }

    const latest = (await (this.model as any)
      .findOne({ tenantId: oid })
      .sort({ version: -1 })
      .lean()) as IConfigSnapshot | null;
    const version = (latest?.version ?? 0) + 1;

    try {
      const created = await (this.model as any).create({ tenantId: oid, version, contentHash, config });
      return { snapshotId: String(created._id), version };
    } catch (err: any) {
      // Duplicate-key race: another run created this exact config concurrently — fetch + reuse.
      if (err?.code === 11000) {
        const row = (await (this.model as any)
          .findOne({ tenantId: oid, contentHash })
          .lean()) as IConfigSnapshot | null;
        if (row) return { snapshotId: String((row as any)._id), version: row.version };
      }
      throw err;
    }
  }
}
