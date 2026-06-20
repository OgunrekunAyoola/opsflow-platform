import type { Model } from 'mongoose';
import type { IUser } from '../../models/User';
import { BaseRepository } from './BaseRepository';

export class UserRepository extends BaseRepository<IUser> {
  constructor(model: Model<IUser>) {
    super(model, 'users', true); // soft-delete enabled
  }

  /** Find user by email within a tenant (normal auth path). */
  async findByEmail(tenantId: string, email: string): Promise<IUser | null> {
    return this.findOne(tenantId, { email: email.toLowerCase() } as any);
  }

  /**
   * Cross-tenant email lookup — used ONLY by auth middleware during login,
   * where the tenant is not yet known. Do not use for data queries.
   */
  async findByEmailGlobal(email: string): Promise<IUser | null> {
    return (this.model as any).findOne({ email: email.toLowerCase() }).lean() as Promise<IUser | null>;
  }

  /** Find all admin-role users for a tenant. Used for notifications. */
  async findAdmins(tenantId: string): Promise<IUser[]> {
    return this.find(tenantId, { role: 'admin' } as any);
  }

  /** Find agents matching optional skill/role filter. Used by AssignmentService. */
  async findAgents(
    tenantId: string,
    filter: { role?: string | string[]; skills?: string[] } = {},
  ): Promise<IUser[]> {
    const query: Record<string, unknown> = {};
    if (filter.role) {
      query.role = Array.isArray(filter.role) ? { $in: filter.role } : filter.role;
    }
    if (filter.skills?.length) {
      query.skills = { $in: filter.skills };
    }
    return this.find(tenantId, query as any);
  }

  /** Find user by name pattern (case-insensitive). Used for @mention resolution. */
  async findByNamePattern(tenantId: string, namePattern: RegExp): Promise<IUser | null> {
    return this.findOne(tenantId, { name: { $regex: namePattern } } as any);
  }
}
