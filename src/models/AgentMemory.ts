import type { Document, Types } from 'mongoose';

export interface IAgentMemory extends Document {
  tenantId: Types.ObjectId;
  canonicalCustomerId: string;
  keyFacts: string[];
  preferredChannel?: string;
  preferredTone?: string;
  resolvedCategories: string[];
  openIssues: string[];
  totalInteractions: number;
  lastUpdatedAt: Date;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export function buildAgentMemorySchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const AgentMemorySchema = new Schema<IAgentMemory>(
    {
      tenantId:            { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
      canonicalCustomerId: { type: String, required: true },
      keyFacts:            { type: [String], default: [] },
      preferredChannel:    { type: String },
      preferredTone:       { type: String },
      resolvedCategories:  { type: [String], default: [] },
      openIssues:          { type: [String], default: [] },
      totalInteractions:   { type: Number, default: 0 },
      lastUpdatedAt:       { type: Date, default: Date.now },
      expiresAt:           { type: Date },
    },
    { timestamps: true },
  );
  AgentMemorySchema.index({ tenantId: 1, canonicalCustomerId: 1 }, { unique: true });
  AgentMemorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });
  return AgentMemorySchema;
}
