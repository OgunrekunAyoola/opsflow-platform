import type { Document, Types } from 'mongoose';
import { ESCALATION_URGENCIES } from '@opsflow/contracts';

export type EscalationUrgency = 'low' | 'medium' | 'high' | 'emergency';

export interface IEscalationHandoff extends Document {
  handoffId: string;
  ticketId: Types.ObjectId;
  threadId?: string;
  tenantId: Types.ObjectId;
  customerId: string;
  escalatedAt: Date;
  escalationReason: string;
  escalationUrgency: EscalationUrgency;
  customer: {
    name?: string;
    channel: string;
    channelAddress?: string;
    customerTier?: string;
    sentiment?: string;
    language?: string;
    priorTicketCount: number;
    priorEscalationCount: number;
  };
  conversation: {
    ticketSummary: string;
    verbatimMessages: Array<{ role: string; content: string; sentAt: Date }>;
    threadSummary?: string;
    customerFacts: string[];
  };
  aiActions: {
    triageCategory?: string;
    ragLayersAccessed: string[];
    toolsAttempted: Array<{ name: string; success: boolean; error?: string }>;
    draftGenerated: boolean;
    draft?: string;
    qualityScore?: number;
  };
  paymentContext?: {
    type: string;
    requiresHuman: boolean;
    confidence: number;
    extractedAmount?: string;
    extractedMethod?: string;
    extractedReference?: string;
  };
  recommendedResponse?: string;
  resolutionNote?: string;
  assignedAgentId?: string;
  acknowledged: boolean;
  handedBackToAI: boolean;
  verifiedFacts?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export function buildEscalationHandoffSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  return new Schema<IEscalationHandoff>(
    {
      handoffId: { type: String, required: true, unique: true },
      ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
      threadId: { type: String },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      customerId: { type: String, required: true },
      escalatedAt: { type: Date, required: true },
      escalationReason: { type: String, required: true },
      escalationUrgency: { type: String, enum: [...ESCALATION_URGENCIES], default: 'medium' },
      customer: { type: Schema.Types.Mixed, required: true },
      conversation: { type: Schema.Types.Mixed, required: true },
      aiActions: { type: Schema.Types.Mixed, required: true },
      recommendedResponse: { type: String },
      resolutionNote: { type: String },
      assignedAgentId: { type: String },
      paymentContext: { type: Schema.Types.Mixed },
      acknowledged: { type: Boolean, default: false },
      handedBackToAI: { type: Boolean, default: false },
      verifiedFacts: { type: Schema.Types.Mixed },
    },
    { timestamps: true },
  );
}
