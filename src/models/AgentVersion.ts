import type { Document, Types } from 'mongoose';

export type AgentVersionStatus = 'shadow' | 'canary' | 'production' | 'retired';

export interface IAgentVersion extends Document {
  tenantId: Types.ObjectId;
  agentId: string;
  versionId: string;
  promptVersionId?: Types.ObjectId;
  status: AgentVersionStatus;
  trafficPercent: number;
  promotedAt?: Date;
  retiredAt?: Date;
  createdBy?: string;
  createdAt?: Date;
}

export function buildAgentVersionSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const AgentVersionSchema = new Schema<IAgentVersion>(
    {
      tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
      agentId: { type: String, required: true, index: true },
      versionId: { type: String, required: true },
      promptVersionId: { type: Schema.Types.ObjectId, ref: 'PromptVersion', default: null },
      status: { type: String, enum: ['shadow', 'canary', 'production', 'retired'], required: true },
      trafficPercent: { type: Number, required: true, min: 0, max: 100, default: 0 },
      promotedAt: { type: Date },
      retiredAt: { type: Date },
      createdBy: { type: String },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  );
  AgentVersionSchema.index({ tenantId: 1, agentId: 1, status: 1 });
  AgentVersionSchema.index({ tenantId: 1, agentId: 1, versionId: 1 }, { unique: true });
  return AgentVersionSchema;
}
