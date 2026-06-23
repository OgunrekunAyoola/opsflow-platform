import type { Model } from 'mongoose';
import type { IProductCatalog } from '../../models/ProductCatalog';
import { BaseRepository } from './BaseRepository';

export class ProductCatalogRepository extends BaseRepository<IProductCatalog> {
  constructor(model: Model<IProductCatalog>) {
    super(model, 'product_catalogs');
  }

  async upsertFromSync(tenantId: string, productId: string, fields: Record<string, unknown>): Promise<void> {
    await (this.model as any).findOneAndUpdate(
      { tenantId: this.toObjectId(tenantId), productId },
      { $set: fields },
      { upsert: true, new: true },
    );
  }

  async findActiveByProductId(tenantId: string, productId: string): Promise<IProductCatalog | null> {
    return this.findOne(tenantId, { productId, status: 'active' } as any);
  }

  async searchActive(tenantId: string, words: string[], limit: number): Promise<IProductCatalog[]> {
    const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(escaped.join('|'), 'i');
    return (this.model as any)
      .find({
        tenantId: this.toObjectId(tenantId),
        status: 'active',
        $or: [{ name: regex }, { description: regex }, { tags: { $in: words } }, { category: regex }],
      })
      .limit(limit)
      .lean()
      .exec() as Promise<IProductCatalog[]>;
  }

  /** Find the ACTIVE product that contains a variant with this exact SKU (for order capture). */
  async findBySku(tenantId: string, sku: string): Promise<IProductCatalog | null> {
    return (this.model as any)
      .findOne({ tenantId: this.toObjectId(tenantId), status: 'active', 'variants.sku': sku })
      .lean()
      .exec() as Promise<IProductCatalog | null>;
  }

  async distinctCategories(tenantId: string): Promise<string[]> {
    const cats = (await (this.model as any).distinct('category', {
      tenantId: this.toObjectId(tenantId),
      status: 'active',
    })) as string[];
    return cats.filter(Boolean);
  }
}
