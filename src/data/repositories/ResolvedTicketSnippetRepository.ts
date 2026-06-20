import type { Model } from 'mongoose';
import type { IResolvedTicketSnippet } from '../../models/ResolvedTicketSnippet';
import { BaseRepository } from './BaseRepository';

export class ResolvedTicketSnippetRepository extends BaseRepository<IResolvedTicketSnippet> {
  constructor(model: Model<IResolvedTicketSnippet>) {
    super(model, 'resolved_ticket_snippets', true);
  }

  async findByTicket(tenantId: string, ticketId: string): Promise<IResolvedTicketSnippet | null> {
    return this.findOne(tenantId, { ticketId } as any);
  }

  async findRecent(tenantId: string, limit: number): Promise<IResolvedTicketSnippet[]> {
    return (this.model as any)
      .find({ tenantId: this.toObjectId(tenantId), deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec() as Promise<IResolvedTicketSnippet[]>;
  }

  async upsertByTicket(
    tenantId: string,
    ticketId: string,
    doc: { snippetText: string; embedding: number[]; intent?: string; finalAnswer?: string },
  ): Promise<void> {
    await (this.model as any).findOneAndUpdate(
      { tenantId: this.toObjectId(tenantId), deletedAt: null, ticketId },
      { ...doc, updatedAt: new Date() },
      { upsert: true, new: true },
    );
  }
}
