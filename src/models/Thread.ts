import type { Document, Types } from 'mongoose';

export type ThreadState =
  | 'idle'
  | 'active'
  | 'pending_customer'
  | 'pending_vendor'
  | 'pending_human'
  | 'resolved';
export type ChannelType = 'email' | 'whatsapp' | 'web_form' | 'integration';

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
  firstContactAt: Date;
  lastCustomerMessageAt: Date;
  lastActivityAt: Date;
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
      firstContactAt: { type: Date, required: true },
      lastCustomerMessageAt: { type: Date, required: true },
      lastActivityAt: { type: Date, required: true, index: true },
    },
    { timestamps: true },
  );
  ThreadSchema.index({ tenantId: 1, customerId: 1, channel: 1 }, { unique: true });
  ThreadSchema.index({ state: 1, lastActivityAt: 1 });
  return ThreadSchema;
}
