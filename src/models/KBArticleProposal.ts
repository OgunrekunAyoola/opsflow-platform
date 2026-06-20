import type { Document, Types } from 'mongoose';

export interface IKBArticleProposal extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  title: string;
  content: string;
  sourceTicketIds: Types.ObjectId[];
  status: 'pending' | 'approved' | 'rejected';
  confidenceScore: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function buildKBArticleProposalSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  return new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      title: { type: String, required: true },
      content: { type: String, required: true },
      sourceTicketIds: [{ type: Schema.Types.ObjectId, ref: 'Ticket' }],
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
      confidenceScore: { type: Number, default: 0 },
      tags: { type: [String], default: [] },
    },
    { timestamps: true },
  );
}
