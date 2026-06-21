import type { Model } from 'mongoose';
import type { IKBArticle } from '../../models/KBArticle';
import { BaseRepository } from './BaseRepository';

export class KBArticleRepository extends BaseRepository<IKBArticle> {
  constructor(model: Model<IKBArticle>) {
    super(model, 'kb_articles', true); // soft-delete enabled
  }

  async search(tenantId: string, query?: string): Promise<IKBArticle[]> {
    if (!query?.trim()) {
      return this.find(tenantId, {} as any);
    }
    const s = query.trim();
    return this.find(tenantId, {
      $or: [
        { title: { $regex: s, $options: 'i' } },
        { body: { $regex: s, $options: 'i' } },
        { tags: { $elemMatch: { $regex: s, $options: 'i' } } },
      ],
    } as any);
  }

  async updateArticle(
    tenantId: string,
    id: string,
    fields: { title?: string; body?: string; tags?: string[]; updatedById?: string },
  ): Promise<IKBArticle | null> {
    return this.updateById(tenantId, id, { $set: fields });
  }
}
