import type { Document, Types } from 'mongoose';

export interface IPromptVersion extends Document {
  tenantId?: Types.ObjectId;  // null = global default
  name: string;
  version: number;
  content: string;
  isActive: boolean;
  createdBy?: string;
  createdAt?: Date;
}

export function buildPromptVersionSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const PromptVersionSchema = new Schema<IPromptVersion>(
    {
      tenantId:  { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
      name:      { type: String, required: true },
      version:   { type: Number, required: true },
      content:   { type: String, required: true },
      isActive:  { type: Boolean, default: true },
      createdBy: { type: String },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  );
  PromptVersionSchema.index({ tenantId: 1, name: 1, isActive: 1 });
  PromptVersionSchema.index({ name: 1, version: 1 });
  return PromptVersionSchema;
}
