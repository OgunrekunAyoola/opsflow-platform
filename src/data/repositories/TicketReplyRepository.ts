import type { Model } from 'mongoose';
import type { ITicketReply } from '../../models/TicketReply';
import { BaseRepository } from './BaseRepository';

export class TicketReplyRepository extends BaseRepository<ITicketReply> {
  constructor(model: Model<ITicketReply>) {
    super(model, 'ticket_replies', true); // soft-delete enabled
  }

  async findByTicket(tenantId: string, ticketId: string): Promise<ITicketReply[]> {
    return (this.model as any)
      .find({ tenantId: this.toObjectId(tenantId), ticketId: this.toObjectId(ticketId), deletedAt: null })
      .sort({ createdAt: 1 })
      .lean() as Promise<ITicketReply[]>;
  }

  /** Customer-portal thread: public replies only, oldest first, display fields only. */
  async findPublicByTicket(tenantId: string, ticketId: string): Promise<ITicketReply[]> {
    return (this.model as any)
      .find({
        tenantId: this.toObjectId(tenantId),
        ticketId: this.toObjectId(ticketId),
        isInternalNote: { $ne: true },
        type: { $ne: 'internal_note' },
      })
      .sort({ createdAt: 1 })
      .select('body createdAt authorType authorName type')
      .lean() as Promise<ITicketReply[]>;
  }

  async findLastHumanReply(tenantId: string, ticketId: string): Promise<ITicketReply | null> {
    const replies = (await (this.model as any)
      .find({
        tenantId: this.toObjectId(tenantId),
        ticketId: this.toObjectId(ticketId),
        authorType: 'human',
        deletedAt: null,
      })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean()) as ITicketReply[];
    return replies[0] ?? null;
  }

  async addReply(tenantId: string, data: Omit<Partial<ITicketReply>, 'tenantId'>): Promise<ITicketReply> {
    return this.create(tenantId, data as any);
  }

  /** Create a reply and return the live Mongoose document (caller needs .save()/.populate()). */
  async createReply(tenantId: string, data: Omit<Partial<ITicketReply>, 'tenantId'>) {
    return (this.model as any).create({ ...data, tenantId: this.toObjectId(tenantId) });
  }

  async findByTicketWithPopulate(tenantId: string, ticketId: string) {
    return (this.model as any)
      .find({ tenantId: this.toObjectId(tenantId), ticketId: this.toObjectId(ticketId), deletedAt: null })
      .populate('authorId', 'name email')
      .sort({ createdAt: 1 })
      .exec();
  }

  async updateDelivery(tenantId: string, replyId: string, status: string): Promise<void> {
    await this.updateById(tenantId, replyId, { $set: { deliveryStatus: status } });
  }
}
