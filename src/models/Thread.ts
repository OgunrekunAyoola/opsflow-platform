import type { Document, Types } from 'mongoose';

export type ThreadState =
  | 'idle'
  | 'active'
  | 'pending_customer'
  | 'pending_vendor'
  | 'pending_human'
  | 'resolved';
export type ChannelType = 'email' | 'whatsapp' | 'web_form' | 'integration';

/**
 * The conversation's in-flight Job (CONVERSATION_ENGINE_DESIGN §4). Stored structurally here at the
 * persistence boundary; the Job state machine + slot semantics are domain-owned (@opsflow/domain-support).
 * `state`/`awaiting` let the next turn resume a paused job instead of re-triaging.
 */
export interface ActiveJob {
  type: string;
  state: string;
  slots: Record<string, unknown>;
  awaiting: string | null;
}

export interface IThread extends Document {
  tenantId: Types.ObjectId;
  customerId: string;
  channel: ChannelType;
  channelAddress: string;
  state: ThreadState;
  stateUpdatedAt: Date;
  currentTicketId?: Types.ObjectId;
  lastTicketId?: Types.ObjectId;
  lastResolvedAt?: Date;
  totalTickets: number;
  reopenWindowMs: number;
  pendingCustomerTimeoutMs: number;
  pendingVendorTimeoutMs: number;
  threadSummary?: string;
  keyFacts: string[];
  activeJob?: ActiveJob | null;
  firstContactAt: Date;
  lastCustomerMessageAt: Date;
  lastActivityAt: Date;
  /**
   * Coexistence (WHATSAPP_COEXISTENCE_PLAN.md D3/D4, DEC-5b): set when a vendor replies to this
   * customer from their own WhatsApp Business app. While `aiSuppressedUntil > now`, the
   * ConversationTurnService takeover gate routes every inbound on this thread to the human queue
   * without running the driver. Refreshed (not just set) on every vendor echo. Independent of
   * `state` — a new customer message flips `state` back to 'active' (TicketService's normal ingest
   * transition) well before this window naturally expires.
   */
  aiSuppressedUntil?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export function buildThreadSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const ThreadSchema = new Schema<IThread>(
    {
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      customerId: { type: String, required: true, index: true },
      channel: { type: String, enum: ['email', 'whatsapp', 'web_form', 'integration'], required: true },
      channelAddress: { type: String, required: true },
      state: {
        type: String,
        enum: ['idle', 'active', 'pending_customer', 'pending_vendor', 'pending_human', 'resolved'],
        default: 'idle',
        index: true,
      },
      stateUpdatedAt: { type: Date, default: Date.now },
      currentTicketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },
      lastTicketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },
      lastResolvedAt: { type: Date },
      totalTickets: { type: Number, default: 0 },
      reopenWindowMs: { type: Number, default: 2 * 60 * 60 * 1000 },
      pendingCustomerTimeoutMs: { type: Number, default: 4 * 60 * 60 * 1000 },
      pendingVendorTimeoutMs: { type: Number, default: 30 * 60 * 1000 },
      threadSummary: { type: String, maxlength: 3000 },
      keyFacts: { type: [String], default: [] },
      activeJob: { type: Schema.Types.Mixed, default: null },
      firstContactAt: { type: Date, required: true },
      lastCustomerMessageAt: { type: Date, required: true },
      lastActivityAt: { type: Date, required: true, index: true },
      aiSuppressedUntil: { type: Date },
    },
    { timestamps: true },
  );
  ThreadSchema.index({ tenantId: 1, customerId: 1, channel: 1 }, { unique: true });
  ThreadSchema.index({ state: 1, lastActivityAt: 1 });
  return ThreadSchema;
}
