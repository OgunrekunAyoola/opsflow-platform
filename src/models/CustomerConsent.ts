import type { Document, Types } from 'mongoose';
import { CHANNELS, CONSENT_STATUSES } from '@opsflow/contracts';

export type ConsentStatus = 'granted' | 'revoked' | 'pending';

export interface ICustomerConsent extends Document {
  tenantId: Types.ObjectId;
  canonicalId: string;
  channel: 'email' | 'whatsapp' | 'web_form' | 'integration';
  status: ConsentStatus;
  aiDisclosureShown: boolean;
  humanOnlyMode: boolean;
  optOutAt?: Date;
  optInAt?: Date;
  updatedAt?: Date;
  createdAt?: Date;
}

export function buildCustomerConsentSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const CustomerConsentSchema = new Schema<ICustomerConsent>(
    {
      tenantId:         { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
      canonicalId:      { type: String, required: true },
      channel:          { type: String, enum: [...CHANNELS], required: true },
      status:           { type: String, enum: [...CONSENT_STATUSES], default: 'pending' },
      aiDisclosureShown:{ type: Boolean, default: false },
      humanOnlyMode:    { type: Boolean, default: false },
      optOutAt:         { type: Date },
      optInAt:          { type: Date },
    },
    { timestamps: true },
  );
  CustomerConsentSchema.index({ tenantId: 1, canonicalId: 1, channel: 1 }, { unique: true });
  return CustomerConsentSchema;
}
