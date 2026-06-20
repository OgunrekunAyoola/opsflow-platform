import type { Document, Types } from 'mongoose';

export interface IKBArticle extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  title: string;
  body: string;
  tags?: string[];
  createdById?: Types.ObjectId;
  updatedById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export function buildKBArticleSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const KBArticleSchema = new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      title: { type: String, required: true },
      body: { type: String, required: true },
      tags: { type: [String], default: [] },
      createdById: { type: Schema.Types.ObjectId, ref: 'User' },
      updatedById: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true },
  );
  KBArticleSchema.index({ tenantId: 1, title: 1 });
  return KBArticleSchema;
}
