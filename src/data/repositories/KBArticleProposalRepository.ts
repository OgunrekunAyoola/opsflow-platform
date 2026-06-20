import type { Model } from 'mongoose';
import type { IKBArticleProposal } from '../../models/KBArticleProposal';
import { BaseRepository } from './BaseRepository';

export class KBArticleProposalRepository extends BaseRepository<IKBArticleProposal> {
  constructor(model: Model<IKBArticleProposal>) {
    super(model, 'kb_article_proposals', true); // soft-delete enabled
  }

  async findPending(tenantId: string): Promise<IKBArticleProposal[]> {
    return (this.model as any)
      .find({ tenantId: this.toObjectId(tenantId), deletedAt: null, status: 'pending' })
      .sort({ confidenceScore: -1 })
      .lean() as Promise<IKBArticleProposal[]>;
  }

  async approve(tenantId: string, id: string): Promise<IKBArticleProposal | null> {
    return this.updateById(tenantId, id, { $set: { status: 'approved' } });
  }

  async reject(tenantId: string, id: string): Promise<IKBArticleProposal | null> {
    return this.updateById(tenantId, id, { $set: { status: 'rejected' } });
  }

  async findExistingPending(
    tenantId: string,
    filter: Partial<{ title: string; status: string }>,
  ): Promise<IKBArticleProposal | null> {
    return this.findOne(tenantId, { ...filter, status: 'pending' } as any);
  }
}
