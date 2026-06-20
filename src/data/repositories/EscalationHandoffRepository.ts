import type { Model } from 'mongoose';
import type { IEscalationHandoff } from '../../models/EscalationHandoff';
import { BaseRepository } from './BaseRepository';

export class EscalationHandoffRepository extends BaseRepository<IEscalationHandoff> {
  constructor(model: Model<IEscalationHandoff>) {
    super(model, 'escalationhandoffs', false);
  }

  async findOpen(tenantId: string): Promise<IEscalationHandoff[]> {
    return this.find(tenantId, { resolvedAt: { $exists: false } });
  }

  async findByTicket(tenantId: string, ticketId: string): Promise<IEscalationHandoff | null> {
    return this.findOne(tenantId, { ticketId: this.toObjectId(ticketId) });
  }

  async resolve(tenantId: string, handoffId: string, resolvedBy: string): Promise<IEscalationHandoff | null> {
    return this.updateById(tenantId, handoffId, { $set: { resolvedAt: new Date(), resolvedBy } });
  }

  async countByCustomer(tenantId: string, canonicalId: string): Promise<number> {
    return (this.model as any).countDocuments({
      tenantId: this.toObjectId(tenantId),
      canonicalCustomerId: canonicalId,
    });
  }

  async findByHandoffId(tenantId: string, handoffId: string): Promise<IEscalationHandoff | null> {
    return this.findOne(tenantId, { handoffId } as any);
  }

  async updateHandback(tenantId: string, handoffId: string): Promise<void> {
    await (this.model as any).updateOne(
      { tenantId: this.toObjectId(tenantId), handoffId },
      { $set: { handedBackToAI: true, acknowledged: true } },
    );
  }
}
