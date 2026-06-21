import type { Model } from 'mongoose';
import type { ICustomerIdentity } from '../../models/CustomerIdentity';
import { BaseRepository } from './BaseRepository';

export class CustomerIdentityRepository extends BaseRepository<ICustomerIdentity> {
  constructor(model: Model<ICustomerIdentity>) {
    super(model, 'customer_identities');
  }

  async findByPhone(tenantId: string, phone: string): Promise<ICustomerIdentity | null> {
    return this.findOne(tenantId, { phone } as any);
  }

  async findByEmail(tenantId: string, email: string): Promise<ICustomerIdentity | null> {
    return this.findOne(tenantId, { email } as any);
  }

  async updateLastSeen(
    tenantId: string,
    id: string,
    extras: { email?: string; phone?: string; name?: string },
  ): Promise<void> {
    await this.updateById(tenantId, id, { $set: { lastSeenAt: new Date(), ...extras } });
  }

  async createIdentity(
    tenantId: string,
    data: Pick<ICustomerIdentity, 'canonicalId' | 'firstSeenAt' | 'lastSeenAt'> & {
      email?: string;
      phone?: string;
      name?: string;
    },
  ): Promise<ICustomerIdentity> {
    return this.create(tenantId, data as any);
  }

  async incrementTicketCount(tenantId: string, canonicalId: string): Promise<void> {
    await (this.model as any).updateOne(
      { tenantId: this.toObjectId(tenantId), canonicalId },
      { $inc: { totalTickets: 1 }, $set: { lastSeenAt: new Date() } },
    );
  }
}
