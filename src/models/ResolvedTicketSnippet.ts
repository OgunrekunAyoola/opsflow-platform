import type { Document, Types } from 'mongoose';

export interface IResolvedTicketSnippet extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  ticketId: Types.ObjectId;
  snippetText: string;
  embedding: number[];
  intent?: string;
  finalAnswer?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function buildResolvedTicketSnippetSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const ResolvedTicketSnippetSchema = new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
      snippetText: { type: String, required: true },
      embedding: { type: [Number], required: true },
      intent: { type: String },
      finalAnswer: { type: String },
    },
    { timestamps: true },
  );
  ResolvedTicketSnippetSchema.index({ tenantId: 1, ticketId: 1 }, { unique: true });
  return ResolvedTicketSnippetSchema;
}
