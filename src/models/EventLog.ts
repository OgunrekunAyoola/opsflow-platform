import type { Document, Types } from 'mongoose';

export interface IEventLog extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  source: string;
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  payload: any;
  status: 'processed' | 'ignored';
  relatedTicketId?: Types.ObjectId;
  createdAt: Date;
}

export function buildEventLogSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  return new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      source: { type: String, required: true },
      eventType: { type: String, required: true },
      severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
      payload: { type: Schema.Types.Mixed },
      status: { type: String, enum: ['processed', 'ignored'], default: 'ignored' },
      relatedTicketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },
    },
    { timestamps: true },
  );
}
