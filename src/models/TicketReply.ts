import type { Document, Types } from 'mongoose';

export interface ITicketReply extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  ticketId: Types.ObjectId;
  authorType: 'ai' | 'human';
  authorId?: Types.ObjectId;
  /**
   * Coexistence (WHATSAPP_COEXISTENCE_PLAN.md D3.2): set only for a vendor's own WhatsApp Business
   * app reply, echoed in via `smb_message_echoes`. Omitted for every desk/API-authored reply
   * (agent desk, AI) — those still ride `authorType` alone, unchanged.
   */
  via?: 'whatsapp_app';
  body: string;
  deliveryStatus?: 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed';
  deliveredAt?: Date;
  deliveryProvider?: string;
  providerMessageId?: string;
  deliveryError?: string;
  isInternalNote?: boolean;
  type?: 'public_reply' | 'internal_note';
  createdAt: Date;
}

export function buildTicketReplySchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  return new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
      authorType: { type: String, enum: ['ai', 'human'], required: true },
      authorId: { type: Schema.Types.ObjectId, ref: 'User' },
      via: { type: String, enum: ['whatsapp_app'] },
      body: { type: String, required: true },
      isInternalNote: { type: Boolean, default: false },
      type: { type: String, enum: ['public_reply', 'internal_note'], default: 'public_reply' },
      deliveryStatus: {
        type: String,
        enum: ['queued', 'sent', 'delivered', 'bounced', 'complained', 'failed'],
      },
      deliveredAt: { type: Date },
      deliveryProvider: { type: String },
      providerMessageId: { type: String, index: true },
      deliveryError: { type: String },
    },
    { timestamps: true },
  );
}
