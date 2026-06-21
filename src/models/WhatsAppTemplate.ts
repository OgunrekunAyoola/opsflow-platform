import type { Document, Types } from 'mongoose';

export type TemplateStatus = 'pending' | 'approved' | 'rejected' | 'paused';
export type TemplateCategory = 'utility' | 'marketing';

export interface IWhatsAppTemplate extends Document {
  tenantId: Types.ObjectId;
  templateName: string;
  language: string;
  category: TemplateCategory;
  content: string;
  placeholders: string[];
  metaTemplateId?: string;
  metaStatus: TemplateStatus;
  metaApprovedAt?: Date;
  metaRejectionReason?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function buildWhatsAppTemplateSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const WhatsAppTemplateSchema = new Schema<IWhatsAppTemplate>(
    {
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      templateName: { type: String, required: true },
      language: { type: String, default: 'en' },
      category: { type: String, enum: ['utility', 'marketing'], required: true },
      content: { type: String, required: true },
      placeholders: { type: [String], default: [] },
      metaTemplateId: { type: String },
      metaStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'paused'], default: 'pending' },
      metaApprovedAt: { type: Date },
      metaRejectionReason: { type: String },
      isActive: { type: Boolean, default: false },
      createdBy: { type: String },
    },
    { timestamps: true },
  );
  WhatsAppTemplateSchema.index({ tenantId: 1, templateName: 1, language: 1 }, { unique: true });
  WhatsAppTemplateSchema.index({ metaStatus: 1, isActive: 1 });
  return WhatsAppTemplateSchema;
}
