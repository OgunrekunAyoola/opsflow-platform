import type { Document, Types } from 'mongoose';
// Shared platform vocabulary — single source in @opsflow/contracts.
// NOTE: `category` stays a free String (domain taxonomy, not platform vocab — N-51)
// and `aiAnalysis.sentiment` stays the model's narrower 3-value set.
import { CHANNELS, TICKET_PRIORITIES, TICKET_STATUSES } from '@opsflow/contracts';

export interface ITicket extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  clientId?: Types.ObjectId;
  canonicalId?: string;
  threadId?: Types.ObjectId;
  subject: string;
  body: string;
  messageId?: string;
  channel: 'email' | 'web_form' | 'integration' | 'whatsapp';
  status:
    | 'new'
    | 'triaged'
    | 'awaiting_reply'
    | 'replied'
    | 'waiting_on_customer'
    | 'closed'
    | 'auto_resolved'
    | 'resolved'
    | 'triaging';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  assigneeId?: Types.ObjectId;
  createdById?: Types.ObjectId;
  aiDraft?: { body?: string; confidence?: number };
  aiAnalysis?: {
    sentiment?: 'positive' | 'neutral' | 'negative';
    priorityScore?: number;
    suggestedCategory?: string;
    summary?: string;
    suggestedReply?: string;
    sources?: { id: string; title: string }[];
    faithfulness?: 'high' | 'medium' | 'low';
    completeness?: 'high' | 'medium' | 'low';
    risk?: 'low' | 'medium' | 'high';
    explanation?: string;
  };
  /**
   * What the conversation driver actually DID this turn (the chatbot's own output, not the retired
   * rails engine's inferred aiAnalysis). This is the honest, vendor-facing transparency record — the
   * decision it took, why, whether it answered from grounded facts, and the sources it drew on. The
   * dashboard aggregates from this; the ticket detail renders it. See CONVERSATION_DRIVER_ARCHITECTURE.
   */
  conversationOutcome?: {
    decision: 'send' | 'clarify' | 'escalate' | 'human_review';
    reason?: string;
    grounded?: boolean;
    sources?: string[];
    handledAt?: Date;
  };
  isAiTriaged: boolean;
  isDistressed?: boolean;
  slaPolicy?: Types.ObjectId;
  slaStartedAt?: Date;
  slaPausedAt?: Date;
  slaFirstResponseAt?: Date;
  slaResolvedAt?: Date;
  slaBreached: boolean;
  followUpSent?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export function buildTicketSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const TicketSchema = new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      clientId: { type: Schema.Types.ObjectId, ref: 'Client', index: true },
      canonicalId: { type: String, index: true },
      threadId: { type: Schema.Types.ObjectId, ref: 'Thread', index: true },
      subject: { type: String, required: true },
      messageId: { type: String, index: true },
      body: { type: String, required: true },
      channel: { type: String, enum: [...CHANNELS], required: true },
      status: {
        type: String,
        enum: [...TICKET_STATUSES], // single source: @opsflow/contracts (incl. 'resolved' — N-34)
        default: 'new',
        index: true,
      },
      priority: { type: String, enum: [...TICKET_PRIORITIES], default: 'medium' },
      category: { type: String, default: 'general' },
      customerName: { type: String },
      customerEmail: { type: String },
      customerPhone: { type: String, index: true },
      assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
      createdById: { type: Schema.Types.ObjectId, ref: 'User' },
      aiDraft: {
        body: { type: String },
        confidence: { type: Number },
      },
      aiAnalysis: {
        sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },
        priorityScore: { type: Number },
        suggestedCategory: { type: String },
        summary: { type: String },
        suggestedReply: { type: String },
        sources: [{ id: { type: String }, title: { type: String } }],
        faithfulness: { type: String, enum: ['high', 'medium', 'low'] },
        completeness: { type: String, enum: ['high', 'medium', 'low'] },
        risk: { type: String, enum: ['low', 'medium', 'high'] },
        explanation: { type: String },
      },
      conversationOutcome: {
        decision: { type: String, enum: ['send', 'clarify', 'escalate', 'human_review'] },
        reason: { type: String },
        grounded: { type: Boolean },
        sources: [{ type: String }],
        handledAt: { type: Date },
      },
      isAiTriaged: { type: Boolean, default: false },
      isDistressed: { type: Boolean, default: false },
      slaPolicy: { type: Schema.Types.ObjectId, ref: 'SLAPolicy' },
      slaStartedAt: { type: Date },
      slaPausedAt: { type: Date },
      slaFirstResponseAt: { type: Date },
      slaResolvedAt: { type: Date },
      slaBreached: { type: Boolean, default: false },
      followUpSent: { type: Boolean, default: false },
    },
    { timestamps: true },
  );
  return TicketSchema;
}
