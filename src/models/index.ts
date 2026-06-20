// Model schemas (builders) + document interfaces. The host app registers them on
// its own mongoose instance via mongoose.model('X', buildXSchema(mongoose)).
export { buildUserSchema, type IUser } from './User';
export { buildWorkflowStepSchema, type IWorkflowStep } from './WorkflowStep';
export { buildCSATSchema, type ICSAT } from './CSAT';
export { buildClientSchema, type IClient } from './Client';
export { buildDeviceTokenSchema, type IDeviceToken, type DevicePlatform } from './DeviceToken';
export { buildUserActionSchema, type IUserAction } from './UserAction';
export { buildEventLogSchema, type IEventLog } from './EventLog';
export { buildPromptVersionSchema, type IPromptVersion } from './PromptVersion';
export { buildKBArticleProposalSchema, type IKBArticleProposal } from './KBArticleProposal';
export { buildVectorDocSchema, type IVectorDoc } from './VectorDoc';
export { buildCostLedgerSchema, type ICostLedger } from './CostLedger';
export { buildKBArticleSchema, type IKBArticle } from './KBArticle';
export { buildSLAPolicySchema, type ISLAPolicy } from './SLAPolicy';
export { buildMessageQuotaSchema, type IMessageQuota, DAILY_UTILITY_LIMIT, DAILY_MARKETING_LIMIT } from './MessageQuota';
export { buildResolvedTicketSnippetSchema, type IResolvedTicketSnippet } from './ResolvedTicketSnippet';
export { buildAiCorrectionSchema, type IAiCorrection } from './AiCorrection';
export { buildLlmCallLogSchema, type ILlmCallLog } from './LlmCallLog';
export { buildCustomerConsentSchema, type ICustomerConsent, type ConsentStatus } from './CustomerConsent';
export { buildDomainEventLogSchema, type IDomainEventLog } from './DomainEventLog';
export { buildCustomerIdentitySchema, type ICustomerIdentity } from './CustomerIdentity';
export { buildAgentVersionSchema, type IAgentVersion, type AgentVersionStatus } from './AgentVersion';
export { buildSyncedObjectSchema, type ISyncedObject } from './SyncedObject';
export { buildTicketReplySchema, type ITicketReply } from './TicketReply';
