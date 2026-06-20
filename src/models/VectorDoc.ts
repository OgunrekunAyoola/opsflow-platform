import type { Document, Types } from 'mongoose';

export interface IVectorDoc extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  sourceType: 'ticket' | 'doc' | 'web' | 'integration' | 'product';
  sourceId: string;
  content: string;
  metadata?: Record<string, any>;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

export function buildVectorDocSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const VectorDocSchema = new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      sourceType: { type: String, required: true, enum: ['ticket', 'doc', 'web', 'integration', 'product'] },
      sourceId: { type: String, required: true },
      content: { type: String, required: true },
      metadata: { type: Schema.Types.Mixed },
      embedding: { type: [Number], required: true },
    },
    { timestamps: true },
  );
  VectorDocSchema.index({ tenantId: 1, sourceType: 1, sourceId: 1 }, { unique: true });
  return VectorDocSchema;
}
