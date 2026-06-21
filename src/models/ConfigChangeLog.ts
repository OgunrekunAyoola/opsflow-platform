import type { Document, Types } from 'mongoose';

export type ConfigChangeSource = 'dashboard' | 'api' | 'migration';

export interface IConfigChangeLog extends Document {
  tenantId: Types.ObjectId;
  changedBy: string;
  changedAt: Date;
  configKey: string;
  oldValue: unknown;
  newValue: unknown;
  source: ConfigChangeSource;
}

export function buildConfigChangeLogSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const ConfigChangeLogSchema = new Schema<IConfigChangeLog>(
    {
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
      changedBy: { type: String, required: true },
      changedAt: { type: Date, default: Date.now, immutable: true },
      configKey: { type: String, required: true },
      oldValue: { type: Schema.Types.Mixed },
      newValue: { type: Schema.Types.Mixed },
      source: { type: String, enum: ['dashboard', 'api', 'migration'], required: true },
    },
    { timestamps: false },
  );
  // Write-once
  ConfigChangeLogSchema.pre('save', function (next) {
    if (!this.isNew) return next(new Error('ConfigChangeLog records are immutable'));
    next();
  });
  ConfigChangeLogSchema.index({ tenantId: 1, changedAt: -1 });
  return ConfigChangeLogSchema;
}
