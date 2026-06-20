import type { FilterQuery, UpdateQuery } from 'mongoose';

/**
 * ADR-077: Every repository method takes tenantId as its first argument.
 * This makes multi-tenant isolation enforced by signature, not convention.
 */
export interface IRepository<T> {
  /** Find a single document by ID, scoped to tenant. Returns null on miss. */
  findById(tenantId: string, id: string): Promise<T | null>;

  /** Find all documents matching filter, scoped to tenant. */
  find(tenantId: string, filter?: FilterQuery<T>): Promise<T[]>;

  /** Find the first document matching filter, scoped to tenant. */
  findOne(tenantId: string, filter: FilterQuery<T>): Promise<T | null>;

  /** Insert a new document (tenantId injected automatically). */
  create(tenantId: string, data: Partial<T>): Promise<T>;

  /** Update a single document by ID, scoped to tenant. Returns updated doc. */
  updateById(tenantId: string, id: string, update: UpdateQuery<T>): Promise<T | null>;

  /** Soft-delete a document by ID (sets deletedAt). */
  deleteById(tenantId: string, id: string): Promise<boolean>;

  /** Count documents matching filter, scoped to tenant. */
  count(tenantId: string, filter?: FilterQuery<T>): Promise<number>;
}
