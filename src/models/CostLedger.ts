import type { Document, Types } from 'mongoose';

export interface ICostLedger extends Document {
  tenantId: Types.ObjectId;
  ticketId?: Types.ObjectId;
  date: string;
  llmCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  modelName: string;
  task: string;
  createdAt?: Date;
}

export function buildCostLedgerSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const CostLedgerSchema = new Schema<ICostLedger>(
    {
      tenantId:    { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      ticketId:    { type: Schema.Types.ObjectId, ref: 'Ticket' },
      date:        { type: String, required: true },
      llmCostUsd:  { type: Number, required: true },
      inputTokens: { type: Number, default: 0 },
      outputTokens:{ type: Number, default: 0 },
      modelName:   { type: String, required: true },
      task:        { type: String, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  );
  CostLedgerSchema.index({ tenantId: 1, date: 1 });
  return CostLedgerSchema;
}
