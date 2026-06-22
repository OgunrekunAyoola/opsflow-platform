import type { Document, Types } from 'mongoose';
import {
  APPROVAL_STATUSES,
  APPROVAL_TYPES,
  type ApprovalStatus,
  type ApprovalType,
} from '@opsflow/contracts';

/**
 * Approval (HITL G2) — a paused agent action awaiting a human decision. Today the only
 * type is `outbound_response`: the AI drafted a reply, supervised mode holds it, a human
 * approves → it sends (pipeline resumes), rejects → escalate, or it expires (timeout).
 * `payload` carries the held draft + the minimal context needed to resume the send.
 */
export interface IApproval extends Document {
  tenantId: Types.ObjectId;
  ticketId: Types.ObjectId;
  threadId?: Types.ObjectId;
  type: ApprovalType;
  status: ApprovalStatus;
  payload: Record<string, unknown>;
  expiresAt: Date;
  decidedBy?: string;
  decisionReason?: string;
}

export function buildApprovalSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const ApprovalSchema = new Schema<IApproval>(
    {
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
      threadId: { type: Schema.Types.ObjectId, ref: 'Thread' },
      type: { type: String, enum: [...APPROVAL_TYPES], required: true },
      status: { type: String, enum: [...APPROVAL_STATUSES], default: 'pending', index: true },
      payload: { type: Schema.Types.Mixed, default: {} },
      expiresAt: { type: Date, required: true },
      decidedBy: { type: String },
      decisionReason: { type: String },
    },
    { timestamps: true },
  );
  ApprovalSchema.index({ tenantId: 1, status: 1 });
  ApprovalSchema.index({ tenantId: 1, ticketId: 1, status: 1 });
  return ApprovalSchema;
}
