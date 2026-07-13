import type { Document } from 'mongoose';
import { TIER_IDS, TENANT_STATUSES, type Tier, type TenantStatus } from '@opsflow/contracts';

export interface IWhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string; // AES-256-GCM encrypted — always use encryption.ts to read/write
  wabaId?: string;
  webhookVerifyToken?: string;
  isVerified: boolean;
  verifiedAt?: Date;
}

export interface IDeliveryZone {
  name: string;
  feeNaira?: number;
  etaText?: string;
}

/**
 * The deterministic "fact substrate" the driver reads for exact-answer questions (hours, delivery,
 * returns, payment) — distinct from semantic RAG (CONVERSATION_DRIVER_ARCHITECTURE §1, slice 3).
 * The scope half (industry / salesCategories / businessDescription) already lives on the tenant; this
 * is the fact half. All optional — a cold tenant has none, which the readiness gate (C1) checks.
 */
export interface IBusinessProfile {
  hours?: string;
  locations?: string[];
  deliveryZones?: IDeliveryZone[];
  returnPolicy?: string;
  paymentMethods?: string[];
  /**
   * Vendor-authored trust/quality/condition statements (e.g. "All phones are brand new and sealed
   * unless stated", "1-year warranty on laptops"). The bot may RENDER these for authenticity/quality
   * questions; with no covering assurance it must ESCALATE, never free-author "it's genuine"
   * (CONSEQUENCE_TIERED_AUTHORING.md — high-consequence trust claims are render-or-escalate).
   */
  assurances?: string[];
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
  /** HITL G2: when true, a would-be auto-send is held as a pending Approval for human sign-off. */
  supervisedMode?: boolean;
  lastInboundAt?: Date;
  zendeskSubdomain?: string;
  zendeskClientId?: string;
  zendeskToken?: string;
  zendeskRefreshToken?: string;
  zendeskTokenExpiresAt?: Date;
  aiDraftEnabled?: boolean;
  aiUsePastTickets?: boolean;
  onboarded?: boolean;
  /** DomainPack id this tenant runs on (2a); absent ⇒ the default pack ('vendor_support'). */
  domain?: string;
  industry?: string;
  salesCategories?: string[];
  businessDescription?: string;
  businessProfile?: IBusinessProfile;
  teamSize?: string;
  brandTone?: 'professional' | 'friendly' | 'concise';
  escalationThreshold?: number;
  escalationRequiredList?: string[];
  prohibitedTopics?: string[];
  tier: Tier;
  /**
   * Subscription lifecycle (SAAS_BLUEPRINT SB-4). Stamped from day one, observe-only
   * until payments exist — no read path may cut the AI off from it (invariant 2).
   */
  status?: TenantStatus;
  trialEndsAt?: Date | null;
  paidThroughDate?: Date | null;
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
      supervisedMode: { type: Boolean, default: false },
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
      domain: { type: String },
      industry: { type: String },
      salesCategories: { type: [String], default: [] },
      businessDescription: { type: String },
      businessProfile: {
        hours: { type: String },
        locations: { type: [String], default: [] },
        deliveryZones: {
          type: [
            { name: { type: String, required: true }, feeNaira: { type: Number }, etaText: { type: String } },
          ],
          default: [],
        },
        returnPolicy: { type: String },
        paymentMethods: { type: [String], default: [] },
        assurances: { type: [String], default: [] },
      },
      teamSize: { type: String },
      brandTone: { type: String, enum: ['professional', 'friendly', 'concise'], default: 'professional' },
      escalationThreshold: { type: Number, default: 70 },
      escalationRequiredList: { type: [String], default: [] },
      prohibitedTopics: { type: [String], default: [] },
      tier: { type: String, enum: [...TIER_IDS], default: 'starter', index: true },
      status: { type: String, enum: [...TENANT_STATUSES], default: 'trialing', index: true },
      trialEndsAt: { type: Date, default: null },
      paidThroughDate: { type: Date, default: null },
      ticketCap: { type: Number },
      overageRateUsd: { type: Number },
      billingCycleStartDay: { type: Number, default: 1 },
      ticketsUsedThisCycle: { type: Number, default: 0 },
      dailyLlmBudgetUsd: { type: Number },
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
