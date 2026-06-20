import type { Model } from 'mongoose';
import type { ITicket } from '../../models/Ticket';
import { BaseRepository } from './BaseRepository';

export class TicketRepository extends BaseRepository<ITicket> {
  constructor(model: Model<ITicket>) {
    super(model, 'tickets', true); // soft-delete enabled
  }

  async findOpen(tenantId: string): Promise<ITicket[]> {
    return this.find(tenantId, { status: { $nin: ['closed', 'auto_resolved'] } });
  }

  async findByAssignee(tenantId: string, assigneeId: string): Promise<ITicket[]> {
    return this.find(tenantId, { assigneeId: this.toObjectId(assigneeId) });
  }

  async findByStatus(tenantId: string, status: ITicket['status']): Promise<ITicket[]> {
    return this.find(tenantId, { status });
  }

  async resolve(tenantId: string, ticketId: string): Promise<ITicket | null> {
    return this.updateById(tenantId, ticketId, { $set: { status: 'auto_resolved', slaResolvedAt: new Date() } });
  }

  async findBreached(tenantId: string): Promise<ITicket[]> {
    return this.find(tenantId, { slaBreached: true, status: { $nin: ['closed', 'auto_resolved'] } });
  }

  async findByMessageId(tenantId: string, messageId: string): Promise<ITicket | null> {
    return this.findOne(tenantId, { messageId } as any);
  }

  async listPaginated(
    tenantId: string,
    filter: Record<string, unknown>,
    page: number,
    pageSize: number,
  ): Promise<{ items: ITicket[]; total: number }> {
    const baseFilter = { tenantId: this.toObjectId(tenantId), deletedAt: null, ...filter };
    const [total, items] = await Promise.all([
      (this.model as any).countDocuments(baseFilter),
      (this.model as any)
        .find(baseFilter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate('assigneeId', 'name email')
        .populate('clientId', 'name domain')
        .exec(),
    ]);
    return { items, total };
  }

  async findWithDetails(tenantId: string, ticketId: string): Promise<ITicket | null> {
    return (this.model as any)
      .findOne({ _id: this.toObjectId(ticketId), tenantId: this.toObjectId(tenantId), deletedAt: null })
      .populate('assigneeId', 'name email')
      .populate('createdById', 'name email')
      .exec() as Promise<ITicket | null>;
  }

  async findWithSLAPolicy(tenantId: string, ticketId: string): Promise<ITicket | null> {
    return (this.model as any)
      .findOne({ _id: this.toObjectId(ticketId), tenantId: this.toObjectId(tenantId), deletedAt: null })
      .populate('slaPolicy')
      .lean()
      .exec() as Promise<ITicket | null>;
  }

  /** Worker entry point: resolve a ticket before tenant context is known. Caller MUST
   *  derive tenantId from the returned ticket and use tenant-scoped methods after. */
  async findByIdAnyTenant(ticketId: string): Promise<ITicket | null> {
    return (this.model as any)
      .findOne({ _id: this.toObjectId(ticketId), deletedAt: null })
      .lean()
      .exec() as Promise<ITicket | null>;
  }

  /** Cross-tenant sweep for the SLA monitor worker. Deliberately unscoped. */
  async findSLABreachCandidatesAllTenants(): Promise<ITicket[]> {
    return (this.model as any)
      .find({ status: { $nin: ['closed', 'auto_resolved'] }, slaStartedAt: { $exists: true }, slaBreached: false, deletedAt: null })
      .populate('slaPolicy')
      .lean()
      .exec() as Promise<ITicket[]>;
  }

  /** NDPC erasure (ADR-030/031): strip sender PII from every ticket matching the
   *  customer's identifiers — INCLUDING soft-deleted tickets. Bypasses deletedAt:null. */
  async anonymizeCustomerPII(
    tenantId: string,
    identifiers: { email?: string; phone?: string },
  ): Promise<number> {
    const orClauses: Record<string, string>[] = [];
    if (identifiers.email) orClauses.push({ customerEmail: identifiers.email });
    if (identifiers.phone) orClauses.push({ customerPhone: identifiers.phone });
    if (orClauses.length === 0) return 0;

    const result = await (this.model as any).updateMany(
      { tenantId: this.toObjectId(tenantId), $or: orClauses },
      { $unset: { customerEmail: '', customerName: '' } },
    );
    return result.modifiedCount;
  }

  async findByIds(tenantId: string, ids: string[]): Promise<ITicket[]> {
    return this.find(tenantId, { _id: { $in: ids.map((id) => this.toObjectId(id)) } } as any);
  }
}
