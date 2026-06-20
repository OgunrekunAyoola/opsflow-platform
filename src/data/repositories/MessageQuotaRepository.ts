import type { Model } from 'mongoose';
import type { IMessageQuota } from '../../models/MessageQuota';
import { BaseRepository } from './BaseRepository';

export class MessageQuotaRepository extends BaseRepository<IMessageQuota> {
  constructor(model: Model<IMessageQuota>) {
    super(model, 'message_quotas');
  }

  async incrementDailyCount(
    tenantId: string,
    canonicalCustomerId: string,
    channel: string,
    dateKey: string,
    field: 'utilityCount' | 'marketingCount',
  ): Promise<IMessageQuota> {
    return (this.model as any).findOneAndUpdate(
      { tenantId: this.toObjectId(tenantId), canonicalCustomerId, channel, dateKey },
      { $inc: { [field]: 1 } },
      { upsert: true, new: true },
    ).lean() as Promise<IMessageQuota>;
  }

  async decrementDailyCount(
    tenantId: string,
    canonicalCustomerId: string,
    channel: string,
    dateKey: string,
    field: 'utilityCount' | 'marketingCount',
  ): Promise<void> {
    await (this.model as any).updateOne(
      { tenantId: this.toObjectId(tenantId), canonicalCustomerId, channel, dateKey },
      { $inc: { [field]: -1 } },
    );
  }
}
