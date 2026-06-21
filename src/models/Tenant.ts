import type { Document } from 'mongoose';
import { TIER_IDS, type Tier } from '@opsflow/contracts';

export interface IWhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string; // AES-256-GCM encrypted — always use encryption.ts to read/write
  wabaId?: string;
  webhookVerifyToken?: string;
  isVerified: boolean;
  verifiedAt?: Date;
}

export interface ITenant extends Document {
  deletedAt?: Date | null;
  name: string;
  slug?: string;
  inboundAddress?: string;
  inboundSecret?: string;
  ingestApiKey?: string;
  supportEmail?: string;
  whatsapp?: IWhatsAppConfig;
  autoTriageOnInbound?: boolean;
  autoReplyEnabled?: boolean;
  autoReplyConfidenceThreshold?: number;
  autoReplySafeCategories?: string[];
  lastInboundAt?: Date;
  zendeskSubdomain?: string;
  zendeskClientId?: string;
  zendeskToken?: string;
  zendeskRefreshToken?: string;
  zendeskTokenExpiresAt?: Date;
  aiDraftEnabled?: boolean;
  aiUsePastTickets?: boolean;
  onboarded?: boolean;
  industry?: string;
  salesCategories?: string[];
  businessDescription?: string;
  teamSize?: string;
  brandTone?: 'professional' | 'friendly' | 'concise';
  escalationThreshold?: number;
  escalationRequiredList?: string[];
  prohibitedTopics?: string[];
  tier: Tier;
  paystackWebhookSecret?: string;
  flutterwaveWebhookSecret?: string;
  ticketCap?: number;
  overageRateUsd?: number;
  billingCycleStartDay?: number;
  ticketsUsedThisCycle?: number;
  dailyLlmBudgetUsd?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export function buildTenantSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  return new Schema(
    {
      deletedAt: { type: Date, default: null },
      name: { type: String, required: true },
      slug: { type: String, unique: true, sparse: true },
      inboundAddress: { type: String, unique: true, sparse: true },
      inboundSecret: { type: String, unique: true, sparse: true },
      supportEmail: { type: String },
      autoTriageOnInbound: { type: Boolean, default: false },
      autoReplyEnabled: { type: Boolean, default: false },
      autoReplyConfidenceThreshold: { type: Number, default: 0.9 },
      autoReplySafeCategories: { type: [String], default: ['general', 'feature_request'] },
      lastInboundAt: { type: Date },
      zendeskSubdomain: { type: String },
      zendeskClientId: { type: String },
      zendeskToken: { type: String },
      zendeskRefreshToken: { type: String },
      zendeskTokenExpiresAt: { type: Date },
      aiDraftEnabled: { type: Boolean, default: true },
      aiUsePastTickets: { type: Boolean, default: true },
      ingestApiKey: { type: String, unique: true, sparse: true },
      onboarded: { type: Boolean, default: false },
      industry: { type: String },
      salesCategories: { type: [String], default: [] },
      businessDescription: { type: String },
      teamSize: { type: String },
      brandTone: { type: String, enum: ['professional', 'friendly', 'concise'], default: 'professional' },
      escalationThreshold: { type: Number, default: 70 },
      escalationRequiredList: { type: [String], default: [] },
      prohibitedTopics: { type: [String], default: [] },
      tier: { type: String, enum: [...TIER_IDS], default: 'starter', index: true },
      ticketCap: { type: Number },
      overageRateUsd: { type: Number },
      billingCycleStartDay: { type: Number, default: 1 },
      ticketsUsedThisCycle: { type: Number, default: 0 },
      dailyLlmBudgetUsd: { type: Number },
      paystackWebhookSecret: { type: String },
      flutterwaveWebhookSecret: { type: String },
      whatsapp: {
        phoneNumberId: { type: String },
        accessToken: { type: String },
        wabaId: { type: String },
        webhookVerifyToken: { type: String },
        isVerified: { type: Boolean, default: false },
        verifiedAt: { type: Date },
      },
    },
    { timestamps: true },
  );
}
