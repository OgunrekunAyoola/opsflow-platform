import type { Model } from 'mongoose';
import type { IThread, ThreadState, ChannelType } from '../../models/Thread';
import { BaseRepository } from './BaseRepository';

export class ThreadRepository extends BaseRepository<IThread> {
  constructor(model: Model<IThread>) {
    super(model, 'threads', false); // no soft-delete on threads
  }

  async findForCustomer(tenantId: string, customerId: string, channel: ChannelType): Promise<IThread | null> {
    return this.findOne(tenantId, { customerId, channel });
  }

  async findOrCreateForCustomer(
    tenantId: string,
    customerId: string,
    channel: ChannelType,
    channelAddress: string,
    now: Date,
  ): Promise<IThread> {
    const tid = this.toObjectId(tenantId);
    const doc = await (this.model as any).findOneAndUpdate(
      { tenantId: tid, customerId, channel },
      {
        $setOnInsert: {
          tenantId: tid, customerId, channel, channelAddress,
          state: 'idle', stateUpdatedAt: now, firstContactAt: now, totalTickets: 0, keyFacts: [],
        },
        $set: { lastCustomerMessageAt: now, lastActivityAt: now },
      },
      { upsert: true, new: true, lean: true },
    ) as IThread;
    return doc;
  }

  async findByState(tenantId: string, state: ThreadState): Promise<IThread[]> {
    return this.find(tenantId, { state });
  }

  async transitionState(
    tenantId: string,
    threadId: string,
    state: ThreadState,
    extra: Partial<IThread> = {},
  ): Promise<IThread | null> {
    return this.updateById(tenantId, threadId, { $set: { state, stateUpdatedAt: new Date(), ...extra } });
  }

  async addKeyFact(tenantId: string, threadId: string, fact: string): Promise<IThread | null> {
    return this.updateById(tenantId, threadId, { $addToSet: { keyFacts: fact }, $set: { lastActivityAt: new Date() } });
  }

  async updateSummary(tenantId: string, threadId: string, summary: string): Promise<IThread | null> {
    return this.updateById(tenantId, threadId, { $set: { threadSummary: summary, lastActivityAt: new Date() } });
  }

  async applyTransition(
    tenantId: string,
    threadId: string,
    newState: ThreadState,
    ticketId?: string,
  ): Promise<IThread | null> {
    const now = new Date();
    return (this.model as any).findOneAndUpdate(
      { _id: this.toObjectId(threadId), tenantId: this.toObjectId(tenantId) },
      {
        $set: {
          state: newState, stateUpdatedAt: now, lastActivityAt: now,
          ...(ticketId ? { currentTicketId: this.toObjectId(ticketId) } : {}),
          ...(newState === 'resolved' ? { lastResolvedAt: now } : {}),
        },
        ...(newState === 'resolved' ? { $unset: { currentTicketId: '' } } : {}),
      },
      { new: true, lean: true },
    ) as Promise<IThread | null>;
  }

  async resolveByCurrentTicket(
    tenantId: string,
    ticketId: string,
    extra: Partial<IThread> = {},
  ): Promise<IThread | null> {
    const now = new Date();
    return (this.model as any).findOneAndUpdate(
      { tenantId: this.toObjectId(tenantId), currentTicketId: this.toObjectId(ticketId) },
      {
        $set: {
          state: 'resolved', stateUpdatedAt: now, lastResolvedAt: now, lastActivityAt: now,
          lastTicketId: this.toObjectId(ticketId), ...extra,
        },
        $inc: { totalTickets: 1 },
        $unset: { currentTicketId: '' },
      },
      { new: true, lean: true },
    ) as Promise<IThread | null>;
  }
}
