import type { Document, Types } from 'mongoose';
import { TIER_IDS, type Tier } from '@opsflow/contracts';

export interface ISLAPolicy extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  name: string;
  tier: Tier;
  firstResponseTarget: number;
  resolutionTarget: number;
  businessHoursOnly: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function buildSLAPolicySchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const SLAPolicySchema = new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      name: { type: String, required: true },
      tier: { type: String, enum: [...TIER_IDS], required: true },
      firstResponseTarget: { type: Number, required: true },
      resolutionTarget: { type: Number, required: true },
      businessHoursOnly: { type: Boolean, default: true },
    },
    { timestamps: true },
  );
  SLAPolicySchema.index({ tenantId: 1, name: 1 }, { unique: true });
  return SLAPolicySchema;
}
