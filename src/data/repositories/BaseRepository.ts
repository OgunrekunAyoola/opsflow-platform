import type { Model, FilterQuery, UpdateQuery } from 'mongoose';
import mongoose from 'mongoose';
import type { IRepository } from './IRepository';
import { metrics } from '../../observability/MetricsService';
import logger from '../../shared/utils/logger';

/**
 * ADR-077: Abstract base that wires tenantId isolation and query metrics into
 * every repository operation. Concrete repos extend this and add domain query
 * methods. The host injects the registered Model in the constructor, so platform
 * never registers models or opens a connection — those are the host's. (The repo
 * layer does use mongoose at runtime for ObjectId construction; in production that
 * resolves to the host's single instance via peerDependency — P2/2c.)
 *
 * All methods automatically:
 *   - Inject { tenantId } into every filter (multi-tenancy invariant)
 *   - Inject { deletedAt: null } when the model has soft-delete (ADR-077)
 *   - Emit db_query_duration_ms metric with collection + operation labels
 *   - Log a WARN when a query exceeds 100ms
 */
export abstract class BaseRepository<T> implements IRepository<T> {
  protected readonly model: Model<T>;
  protected readonly collectionName: string;
  /** Set true for models that have a deletedAt field. */
  protected readonly softDelete: boolean;

  constructor(model: Model<T>, collectionName: string, softDelete = false) {
    this.model = model;
    this.collectionName = collectionName;
    this.softDelete = softDelete;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  protected toObjectId(id: string): mongoose.Types.ObjectId {
    // ObjectId is a bson value (version-portable). In production platform resolves
    // mongoose via peerDependency = the host's single instance; in local file: dev
    // it may use platform's own copy (same bson version → query-compatible).
    return new mongoose.Types.ObjectId(id);
  }

  private baseFilter(tenantId: string, extra: FilterQuery<T> = {}): FilterQuery<T> {
    const base: Record<string, unknown> = {
      tenantId: this.toObjectId(tenantId),
      ...extra,
    };
    if (this.softDelete) base['deletedAt'] = null;
    return base as FilterQuery<T>;
  }

  private async timed<R>(operation: string, tenantId: string, fn: () => Promise<R>): Promise<R> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      const ms = Date.now() - start;
      metrics.observe('db_query_duration_ms', ms, {
        collection: this.collectionName,
        operation,
        tenant_id: tenantId,
      });
      if (ms > 100) {
        logger.warn({ event: 'slow_query', collection: this.collectionName, operation, durationMs: ms }, 'Slow DB query');
      }
    }
  }

  // ── IRepository implementation ───────────────────────────────────────────────

  async findById(tenantId: string, id: string): Promise<T | null> {
    return this.timed('findById', tenantId, () =>
      (this.model as any).findOne(this.baseFilter(tenantId, { _id: this.toObjectId(id) })).lean() as Promise<T | null>,
    );
  }

  async find(tenantId: string, filter: FilterQuery<T> = {}): Promise<T[]> {
    return this.timed('find', tenantId, () =>
      (this.model as any).find(this.baseFilter(tenantId, filter)).lean() as Promise<T[]>,
    );
  }

  async findOne(tenantId: string, filter: FilterQuery<T>): Promise<T | null> {
    return this.timed('findOne', tenantId, () =>
      (this.model as any).findOne(this.baseFilter(tenantId, filter)).lean() as Promise<T | null>,
    );
  }

  async create(tenantId: string, data: Partial<T>): Promise<T> {
    return this.timed('create', tenantId, async () => {
      const doc = await this.model.create({
        ...data,
        tenantId: this.toObjectId(tenantId),
      });
      return doc.toObject() as T;
    });
  }

  async updateById(tenantId: string, id: string, update: UpdateQuery<T>): Promise<T | null> {
    return this.timed('updateById', tenantId, () =>
      (this.model as any).findOneAndUpdate(
        this.baseFilter(tenantId, { _id: this.toObjectId(id) }),
        update,
        { new: true, lean: true },
      ) as Promise<T | null>,
    );
  }

  async deleteById(tenantId: string, id: string): Promise<boolean> {
    if (this.softDelete) {
      const result = await this.timed('softDelete', tenantId, () =>
        (this.model as any).updateOne(
          this.baseFilter(tenantId, { _id: this.toObjectId(id) }),
          { $set: { deletedAt: new Date() } },
        ),
      ) as { modifiedCount: number };
      return result.modifiedCount > 0;
    }
    const result = await this.timed('deleteById', tenantId, () =>
      (this.model as any).deleteOne(this.baseFilter(tenantId, { _id: this.toObjectId(id) })),
    ) as { deletedCount: number };
    return result.deletedCount > 0;
  }

  async updateOne(
    tenantId: string,
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    return this.timed('updateOne', tenantId, async () => {
      const result = await (this.model as any).updateOne(this.baseFilter(tenantId, filter), update);
      return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
    });
  }

  async updateMany(
    tenantId: string,
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    return this.timed('updateMany', tenantId, async () => {
      const result = await (this.model as any).updateMany(this.baseFilter(tenantId, filter), update);
      return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
    });
  }

  async count(tenantId: string, filter: FilterQuery<T> = {}): Promise<number> {
    return this.timed('count', tenantId, () =>
      this.model.countDocuments(this.baseFilter(tenantId, filter)) as Promise<number>,
    );
  }
}
