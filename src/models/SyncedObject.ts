import type { Document, Types } from 'mongoose';

export interface ISyncedObject extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  integrationConnectionId: Types.ObjectId;
  provider: string;
  externalId: string;
  type: 'ticket' | 'message' | 'customer' | 'doc' | 'order';
  internalId?: Types.ObjectId;
  lastSyncedAt: Date;
  hash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function buildSyncedObjectSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const SyncedObjectSchema = new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
      integrationConnectionId: { type: Schema.Types.ObjectId, ref: 'IntegrationConnection', required: true },
      provider: { type: String, required: true },
      externalId: { type: String, required: true },
      type: { type: String, enum: ['ticket', 'message', 'customer', 'doc', 'order'], required: true },
      internalId: { type: Schema.Types.ObjectId },
      lastSyncedAt: { type: Date, default: Date.now },
      hash: { type: String },
    },
    { timestamps: true },
  );
  SyncedObjectSchema.index({ tenantId: 1, provider: 1, externalId: 1 }, { unique: true });
  SyncedObjectSchema.index({ internalId: 1 });
  return SyncedObjectSchema;
}
