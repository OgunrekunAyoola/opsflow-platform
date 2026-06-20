import type { Document, Types } from 'mongoose';

export interface ICustomerIdentity extends Document {
  tenantId: Types.ObjectId;
  canonicalId: string;
  email?: string;
  phone?: string;
  name?: string;
  mergedIds: string[];
  totalTickets: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export function buildCustomerIdentitySchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const CustomerIdentitySchema = new Schema<ICustomerIdentity>(
    {
      tenantId:    { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      canonicalId: { type: String, required: true, index: true },
      email:       { type: String, sparse: true },
      phone:       { type: String, sparse: true },
      name:        { type: String },
      mergedIds:   { type: [String], default: [] },
      totalTickets:{ type: Number, default: 0 },
      firstSeenAt: { type: Date, required: true },
      lastSeenAt:  { type: Date, required: true },
    },
    { timestamps: true },
  );
  CustomerIdentitySchema.index({ tenantId: 1, canonicalId: 1 }, { unique: true });
  CustomerIdentitySchema.index({ tenantId: 1, email: 1 }, { sparse: true });
  CustomerIdentitySchema.index({ tenantId: 1, phone: 1 }, { sparse: true });
  return CustomerIdentitySchema;
}
