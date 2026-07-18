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
    // Plural-tolerant: "wigs" must find name "…wig 22 inch" / tag "wig" (stress-run
    // finding, 2026-07-17 — a plural query returned found:0 and the driver told the
    // customer the product doesn't exist). Each word also matches with a trailing
    // s/es stripped; matching stays substring-based, so the singular also finds plurals.
    const expanded = [
      ...new Set(
        words.flatMap((w) => {
          const lower = w.toLowerCase();
          const forms = [lower];
          if (lower.length > 3 && lower.endsWith('es')) forms.push(lower.slice(0, -2));
          if (lower.length > 2 && lower.endsWith('s')) forms.push(lower.slice(0, -1));
          return forms;
        }),
      ),
    ];
    const escaped = expanded.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(escaped.join('|'), 'i');
    return (this.model as any)
      .find({
        tenantId: this.toObjectId(tenantId),
        status: 'active',
        $or: [{ name: regex }, { description: regex }, { tags: { $in: expanded } }, { category: regex }],
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
