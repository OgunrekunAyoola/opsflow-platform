import type { Document, Types } from 'mongoose';

export interface ShadowMetrics {
  toolCallsDiffer: boolean;
  escalationDiffer: boolean;
  responseLengthRatio: number;
  sentimentDiffer: boolean;
}

export interface IShadowComparison extends Document {
  tenantId: Types.ObjectId;
  ticketId: string;
  agentId: string;
  productionVersionId: string;
  shadowVersionId: string;
  productionOutput: string;
  shadowOutput: string;
  driftScore: number;
  metrics: ShadowMetrics;
  createdAt?: Date;
}

export function buildShadowComparisonSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const ShadowComparisonSchema = new Schema<IShadowComparison>(
    {
      tenantId:            { type: Schema.Types.ObjectId, required: true, index: true },
      ticketId:            { type: String, required: true },
      agentId:             { type: String, required: true },
      productionVersionId: { type: String, required: true },
      shadowVersionId:     { type: String, required: true },
      productionOutput:    { type: String, required: true },
      shadowOutput:        { type: String, required: true },
      driftScore:          { type: Number, required: true },
      metrics: {
        toolCallsDiffer:     { type: Boolean, required: true },
        escalationDiffer:    { type: Boolean, required: true },
        responseLengthRatio: { type: Number, required: true },
        sentimentDiffer:     { type: Boolean, required: true },
      },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  );
  ShadowComparisonSchema.index({ agentId: 1, createdAt: -1 });
  ShadowComparisonSchema.index({ tenantId: 1, ticketId: 1 });
  return ShadowComparisonSchema;
}
