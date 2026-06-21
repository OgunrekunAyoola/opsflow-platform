import type { Document, Types } from 'mongoose';
import { encrypt, decrypt } from '../shared/utils/encryption';
import logger from '../shared/utils/logger';

// AES-256-GCM via the shared module (audit N-03 — the old utils/encryption.ts
// was AES-CBC with a hardcoded default key and returned PLAINTEXT on failure).
function encField(v?: string): string | undefined {
  return v ? encrypt(v) : v;
}
function decField(v?: string): string | undefined {
  if (!v) return v;
  try {
    return decrypt(v);
  } catch (err: any) {
    // Fail-closed: never expose ciphertext or fall back to plaintext.
    logger.warn(
      { event: 'integration_token_decrypt_failed', err: err?.message },
      'IntegrationConnection token decrypt failed — re-auth required',
    );
    return undefined;
  }
}

export interface IIntegrationConnection extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  provider: string;
  integrationId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  profile?: any;
  status: 'active' | 'error' | 'disconnected';
  config?: any;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function buildIntegrationConnectionSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const IntegrationConnectionSchema = new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
      provider: { type: String, required: true },
      integrationId: { type: String },
      accessToken: { type: String, set: encField, get: decField },
      refreshToken: { type: String, set: encField, get: decField },
      expiresAt: { type: Date },
      profile: { type: Schema.Types.Mixed },
      status: { type: String, enum: ['active', 'error', 'disconnected'], default: 'active' },
      config: { type: Schema.Types.Mixed, default: {} },
      lastSyncAt: { type: Date },
    },
    {
      timestamps: true,
      toJSON: { getters: true, virtuals: true },
      toObject: { getters: true, virtuals: true },
    },
  );
  IntegrationConnectionSchema.index({ tenantId: 1, provider: 1 }, { unique: true });
  return IntegrationConnectionSchema;
}
