import type { Document, Types } from 'mongoose';

export type NotificationType =
  | 'ticket_assigned' | 'high_priority_ticket' | 'sla_warning' | 'auto_reply_sent'
  | 'team_member_joined' | 'sla_breach' | 'sla_approaching_breach' | 'ticket_reopened'
  | 'mention' | 'ticket_escalated' | 'escalation_handoff' | 'handback_request';

export interface INotification extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  message: string;
  url?: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function buildNotificationSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  return new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      type: {
        type: String,
        enum: [
          'ticket_assigned', 'high_priority_ticket', 'sla_warning', 'auto_reply_sent',
          'team_member_joined', 'sla_breach', 'sla_approaching_breach', 'ticket_reopened',
          'mention', 'ticket_escalated', 'escalation_handoff', 'handback_request',
        ],
        required: true,
        index: true,
      },
      message: { type: String, required: true },
      url: { type: String },
      readAt: { type: Date, index: true },
    },
    { timestamps: true },
  );
}
