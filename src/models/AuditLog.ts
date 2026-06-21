import type { Document, Types } from 'mongoose';

export type AuditActor = 'ai' | 'human' | 'system';

export interface IAuditLog extends Document {
  tenantId: Types.ObjectId;
  ticketId?: Types.ObjectId;
  actor: AuditActor;
  actorId?: string;
  action: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export function buildAuditLogSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const AuditLogSchema = new Schema<IAuditLog>(
    {
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', index: true },
      actor: { type: String, enum: ['ai', 'human', 'system'], required: true },
      actorId: { type: String },
      action: { type: String, required: true },
      metadata: { type: Schema.Types.Mixed },
      createdAt: { type: Date, default: Date.now, immutable: true },
    },
    { timestamps: false },
  );
  // Write-once: disable updates at schema level (ADR-032)
  AuditLogSchema.pre('save', function (next) {
    if (!this.isNew) return next(new Error('AuditLog records are immutable'));
    next();
  });
  // 90-day TTL index (ADR-032)
  AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
  AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
  return AuditLogSchema;
}
