import type { Model } from 'mongoose';
import type { IVectorDoc } from '../../models/VectorDoc';
import { BaseRepository } from './BaseRepository';

export class VectorDocRepository extends BaseRepository<IVectorDoc> {
  constructor(model: Model<IVectorDoc>) {
    super(model, 'vector_docs');
  }

  async upsertBySource(
    tenantId: string,
    sourceType: 'ticket' | 'doc' | 'web' | 'integration' | 'product',
    sourceId: string,
    doc: { content: string; embedding: number[]; metadata?: Record<string, unknown> },
  ): Promise<void> {
    await (this.model as any).findOneAndUpdate(
      { tenantId: this.toObjectId(tenantId), sourceType, sourceId },
      { ...doc, updatedAt: new Date() },
      { upsert: true, new: true },
    );
  }

  async vectorSearch(tenantId: string, embedding: number[], limit: number): Promise<any[]> {
    return (this.model as any).aggregate([
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: embedding,
          numCandidates: limit * 10,
          limit,
          filter: { tenantId: { $eq: this.toObjectId(tenantId) } },
        },
      },
      {
        $project: {
          _id: 0,
          sourceId: 1,
          sourceType: 1,
          content: 1,
          metadata: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);
  }
}
