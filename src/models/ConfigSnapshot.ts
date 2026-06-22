import type { Document, Types } from 'mongoose';

/**
 * ConfigSnapshot (G3) — an immutable, versioned capture of the effective config a pipeline
 * run executed with. A WorkflowRun links to one via configSnapshotId, so any run is
 * reproducible/auditable ("what config produced this?"). Deduplicated by contentHash: an
 * unchanged config reuses its snapshot rather than writing a row per run.
 *
 * Only behavioural knobs are captured (thresholds, escalation list, brand voice, supervised
 * mode, …) — never secrets/PII.
 */
export interface IConfigSnapshot extends Document {
  tenantId: Types.ObjectId;
  version: number; // monotonic per tenant (best-effort label; contentHash is identity)
  contentHash: string;
  config: Record<string, unknown>;
  createdAt: Date;
}

export function buildConfigSnapshotSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const ConfigSnapshotSchema = new Schema<IConfigSnapshot>(
    {
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      version: { type: Number, required: true },
      contentHash: { type: String, required: true },
      config: { type: Schema.Types.Mixed, required: true },
      createdAt: { type: Date, default: Date.now, immutable: true },
    },
    { timestamps: false },
  );
  // Identity + dedup: one row per (tenant, config content). Makes snapshot() idempotent
  // and race-safe (a concurrent duplicate insert is rejected, then fetched).
  ConfigSnapshotSchema.index({ tenantId: 1, contentHash: 1 }, { unique: true });
  ConfigSnapshotSchema.index({ tenantId: 1, version: -1 });
  // Write-once.
  ConfigSnapshotSchema.pre('save', function (next) {
    if (!this.isNew) return next(new Error('ConfigSnapshot records are immutable'));
    next();
  });
  return ConfigSnapshotSchema;
}
