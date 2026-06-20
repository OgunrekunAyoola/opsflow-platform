import type { Document, Types } from 'mongoose';

export interface ICSAT extends Document {
  deletedAt?: Date | null;
  ticketId: Types.ObjectId;
  tenantId: Types.ObjectId;
  rating: number; // 1-5
  comment?: string;
  submittedAt: Date;
}

export function buildCSATSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  return new Schema(
    {
      deletedAt: { type: Date, default: null },
      ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      rating: { type: Number, required: true, min: 1, max: 5 },
      comment: { type: String },
      submittedAt: { type: Date, default: Date.now },
    },
    { timestamps: true },
  );
}
