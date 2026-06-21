import type { Model } from 'mongoose';
import type { IAiCorrection } from '../../models/AiCorrection';
import { BaseRepository } from './BaseRepository';

export class AiCorrectionRepository extends BaseRepository<IAiCorrection> {
  constructor(model: Model<IAiCorrection>) {
    super(model, 'ai_corrections');
  }

  /** Latest correction for one ticket (the final human answer wins). */
  async findLatestByTicket(tenantId: string, ticketId: string): Promise<IAiCorrection | null> {
    const docs = (await (this.model as any)
      .find({ tenantId: this.toObjectId(tenantId), ticketId })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean()) as IAiCorrection[];
    return docs[0] ?? null;
  }

  /** Corrections where the human heavily rewrote the AI draft, newest first. */
  async findHeavyEdits(tenantId: string, minEditRatio: number, limit: number): Promise<IAiCorrection[]> {
    return (this.model as any)
      .find({ tenantId: this.toObjectId(tenantId), editRatio: { $gte: minEditRatio } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec() as Promise<IAiCorrection[]>;
  }
}
