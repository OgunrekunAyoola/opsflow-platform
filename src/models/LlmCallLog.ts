import type { Document, Types } from 'mongoose';

export interface ILlmCallLog extends Document {
  deletedAt?: Date | null;
  tenantId?: Types.ObjectId;
  ticketId?: Types.ObjectId;
  task: 'classification' | 'answer_generation' | 'self_eval' | 'summary' | 'memory_extraction' | 'tool_use';
  modelName: string;
  success: boolean;
  errorMessage?: string;
  latencyMs: number;
  createdAt: Date;
}

export function buildLlmCallLogSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  return new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', index: true },
      ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', index: true },
      task: {
        type: String,
        enum: ['classification', 'answer_generation', 'self_eval', 'summary', 'memory_extraction', 'tool_use'],
        required: true,
        index: true,
      },
      modelName: { type: String, required: true },
      success: { type: Boolean, required: true },
      errorMessage: { type: String },
      latencyMs: { type: Number, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  );
}
