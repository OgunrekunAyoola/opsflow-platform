import type { Document } from 'mongoose';
import type { DomainEventName } from '@opsflow/contracts';

export interface IDomainEventLog extends Document {
  eventId:       string;
  eventName:     DomainEventName;
  tenantId:      string;
  partitionKey:  string;
  occurredAt:    Date;
  correlationId: string;
  payload:       unknown;
  enqueuedAt?:   Date;
}

export function buildDomainEventLogSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const DomainEventLogSchema = new Schema<IDomainEventLog>(
    {
      eventId:       { type: String, required: true, unique: true, index: true },
      eventName:     { type: String, required: true, index: true },
      tenantId:      { type: String, required: true, index: true },
      partitionKey:  { type: String, required: true },
      occurredAt:    { type: Date, required: true },
      correlationId: { type: String, required: true },
      payload:       { type: Schema.Types.Mixed, required: true },
      enqueuedAt:    { type: Date },
    },
    { timestamps: false },
  );
  DomainEventLogSchema.index({ occurredAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
  DomainEventLogSchema.index({ tenantId: 1, eventName: 1, occurredAt: -1 });
  return DomainEventLogSchema;
}
