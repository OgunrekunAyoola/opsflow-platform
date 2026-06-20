import type { Document, Types } from 'mongoose';

export interface IClient extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  name: string;
  domain?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function buildClientSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const ClientSchema = new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      name: { type: String, required: true },
      domain: { type: String },
    },
    { timestamps: true },
  );
  ClientSchema.index({ tenantId: 1, name: 1 }, { unique: true });
  return ClientSchema;
}
