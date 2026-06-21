import type { Model } from 'mongoose';
import type { IConfigChangeLog } from '../../models/ConfigChangeLog';
import { BaseRepository } from './BaseRepository';

export interface ConfigChangeEntry {
  changedBy: string;
  changedAt: Date;
  configKey: string;
  oldValue: unknown;
  newValue: unknown;
  source: string;
}

export class ConfigChangeLogRepository extends BaseRepository<IConfigChangeLog> {
  constructor(model: Model<IConfigChangeLog>) {
    super(model, 'config_change_logs');
  }

  /** Append-only audit trail of config changes (ADR-T4). Never updated after insert. */
  async logChanges(tenantId: string, entries: ConfigChangeEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await (this.model as any).insertMany(entries.map((e) => ({ ...e, tenantId: this.toObjectId(tenantId) })));
  }

  /** Change history, newest first. */
  async getHistory(tenantId: string, limit: number): Promise<IConfigChangeLog[]> {
    return (this.model as any)
      .find({ tenantId: this.toObjectId(tenantId) })
      .sort({ changedAt: -1 })
      .limit(limit)
      .lean() as Promise<IConfigChangeLog[]>;
  }
}
