import type { Document, Types } from 'mongoose';

export type ProductStatus = 'active' | 'discontinued' | 'out_of_stock';

export interface IProductVariant {
  sku: string;
  attributes: Record<string, string>;
  price: number;
  currency: string;
  stockQty?: number;
}

export interface IProductCatalog extends Document {
  tenantId: Types.ObjectId;
  productId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  status: ProductStatus;
  variants: IProductVariant[];
  basePrice: number;
  currency: string;
  returnPolicyDays: number;
  warrantyMonths: number;
  metadata: Record<string, unknown>;
  lastSyncedAt?: Date;
  syncSource?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function buildProductCatalogSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const ProductVariantSchema = new Schema<IProductVariant>(
    {
      sku:        { type: String, required: true },
      attributes: { type: Schema.Types.Mixed, default: {} },
      price:      { type: Number, required: true },
      currency:   { type: String, default: 'USD' },
      stockQty:   { type: Number },
    },
    { _id: false },
  );
  const ProductCatalogSchema = new Schema<IProductCatalog>(
    {
      tenantId:         { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      productId:        { type: String, required: true },
      name:             { type: String, required: true },
      description:      { type: String, default: '' },
      category:         { type: String, required: true, index: true },
      tags:             { type: [String], default: [], index: true },
      status:           { type: String, enum: ['active', 'discontinued', 'out_of_stock'], default: 'active', index: true },
      variants:         { type: [ProductVariantSchema], default: [] },
      basePrice:        { type: Number, required: true },
      currency:         { type: String, default: 'USD' },
      returnPolicyDays: { type: Number, default: 30 },
      warrantyMonths:   { type: Number, default: 0 },
      metadata:         { type: Schema.Types.Mixed, default: {} },
      lastSyncedAt:     { type: Date },
      syncSource:       { type: String },
    },
    { timestamps: true },
  );
  ProductCatalogSchema.index({ tenantId: 1, productId: 1 }, { unique: true });
  ProductCatalogSchema.index({ tenantId: 1, status: 1, category: 1 });
  return ProductCatalogSchema;
}
