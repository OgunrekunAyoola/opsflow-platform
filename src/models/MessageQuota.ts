import type { Document, Types } from 'mongoose';

export interface IMessageQuota extends Document {
  tenantId: Types.ObjectId;
  canonicalCustomerId: string;
  channel: string;
  dateKey: string;
  utilityCount: number;
  marketingCount: number;
  updatedAt?: Date;
}

export const DAILY_UTILITY_LIMIT   = 5;
export const DAILY_MARKETING_LIMIT = 1;

export function buildMessageQuotaSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const MessageQuotaSchema = new Schema<IMessageQuota>(
    {
      tenantId:            { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
      canonicalCustomerId: { type: String, required: true },
      channel:             { type: String, required: true },
      dateKey:             { type: String, required: true },
      utilityCount:        { type: Number, default: 0 },
      marketingCount:      { type: Number, default: 0 },
    },
    { timestamps: true },
  );
  MessageQuotaSchema.index(
    { tenantId: 1, canonicalCustomerId: 1, channel: 1, dateKey: 1 },
    { unique: true },
  );
  return MessageQuotaSchema;
}
