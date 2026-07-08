import type { Model } from 'mongoose';
import type { IUserAction } from '../../models/UserAction';
import { BaseRepository } from './BaseRepository';

export class UserActionRepository extends BaseRepository<IUserAction> {
  constructor(model: Model<IUserAction>) {
    super(model, 'user_actions');
  }

  /** Paginated per-user action history (newest first) — the /actions route's read model. */
  async listForUser(
    tenantId: string,
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: IUserAction[]; total: number }> {
    const filter = { tenantId: this.toObjectId(tenantId), userId };
    const [total, items] = await Promise.all([
      (this.model as any).countDocuments(filter),
      (this.model as any)
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean() as Promise<IUserAction[]>,
    ]);
    return { items, total };
  }
}
