import type { Model } from 'mongoose';
import type { ICustomerConsent } from '../../models/CustomerConsent';
import { BaseRepository } from './BaseRepository';
import type { ChannelType } from '../../models/Thread';

export class CustomerConsentRepository extends BaseRepository<ICustomerConsent> {
  constructor(model: Model<ICustomerConsent>) {
    super(model, 'customerconsents', false);
  }

  /** Find consent record for a specific customer on a channel. */
  async findForCustomer(
    tenantId: string,
    canonicalId: string,
    channel: ChannelType,
  ): Promise<ICustomerConsent | null> {
    return this.findOne(tenantId, { canonicalId, channel });
  }

  /** Revoke both consent types and enable humanOnlyMode (ADR-057 opt-out). */
  async optOut(tenantId: string, canonicalId: string, channel: ChannelType): Promise<void> {
    await (this.model as any).updateOne(
      { tenantId: this.toObjectId(tenantId), canonicalId, channel },
      { $set: { status: 'revoked', humanOnlyMode: true, optOutAt: new Date() } },
      { upsert: true },
    );
  }

  /** Mark AI disclosure as shown and grant consent if not yet set (ADR-057). */
  async markDisclosureShown(tenantId: string, canonicalId: string, channel: ChannelType): Promise<void> {
    await (this.model as any).updateOne(
      { tenantId: this.toObjectId(tenantId), canonicalId, channel },
      { $set: { aiDisclosureShown: true, status: 'granted' }, $setOnInsert: { optInAt: new Date() } },
      { upsert: true },
    );
  }

  /** Record explicit opt-in and re-enable AI routing (ADR-057). */
  async recordOptIn(tenantId: string, canonicalId: string, channel: ChannelType): Promise<void> {
    await (this.model as any).updateOne(
      { tenantId: this.toObjectId(tenantId), canonicalId, channel },
      { $set: { status: 'granted', optInAt: new Date(), humanOnlyMode: false } },
      { upsert: true },
    );
  }
}
