/**
 * @opsflow/platform — the Data plane SDK. Depends on @opsflow/contracts.
 * Dependency direction: contracts → platform → (orchestrator, pipelines, agents, apps).
 *
 * Extraction is phased (P2 sub-slices). Current surface:
 *  - observability: MetricsService (`metrics`, Prometheus) + withNodeMetrics
 *    (tracing is LangSmith, native to LangGraph — ADR-079; no custom tracing)
 *  - secrets: SecretsProvider interface + EnvSecretsProvider + `secrets` singleton
 *  - logger / correlation context / encryption (shared utils)
 *  - models + the repository layer (31 repos, BaseRepository) — host injects models
 *  - infra: Redis client, PIIMasker, PushService
 *  - events: DomainEvent + BullMQEventBus (host injects log/queue/redis)
 *  - llm: computeLlmCostUsd, ModelRouter, Anthropic/Gemini providers, LLMGateway
 *    (host injects providers/eventBus/costTracker/metrics/secrets via deps)
 *  - tools: ToolDefinition/ToolError/contracts, ToolRegistry (host registers domain
 *    tools), ToolsHandle (host injects audit via setToolAuditDeps)
 * The data-plane SDK is complete (P2). Domain capability packages (domain tools,
 * policies) live in domain repos; the orchestrator/pipelines/agents are later phases.
 */

export { metrics, MetricsService } from './observability/MetricsService';
export type { MetricName } from './observability/MetricsService';
export { withNodeMetrics } from './observability/nodeMetrics';
export { default as logger } from './shared/utils/logger';
export * from './shared/utils/correlationContext';
export * from './shared/utils/encryption';
export * from './secrets';
export * from './models';
export * from './data/repositories';
export { getRedisClient, buildConnection, shouldUseMock } from './infra/redis';
export { PIIMasker, piiMasker, PIIMaskingUnavailableError, localFallbackMask } from './pii/PIIMasker';
export type { MaskResult } from './pii/PIIMasker';
export { PushService } from './infra/PushService';
export type { PushMessage, DeviceTokenLookup } from './infra/PushService';
export { makeDomainEvent } from './events/DomainEvent';
export type {
  DomainEvent,
  DomainEventName,
  EventHandler,
  SubscriberOptions,
  IEventBus,
} from './events/DomainEvent';
export { BullMQEventBus } from './events/EventBus';
export type { EventBusDeps, EventLogStore, EventQueue, EventRedis } from './events/EventBus';
export { computeLlmCostUsd } from './llm/cost';
export type { LLMProvider, ProviderMasker, CallLogger, ProviderDeps } from './llm/LLMProvider';
export { ModelRouter } from './llm/ModelRouter';
export { AnthropicProvider } from './llm/AnthropicProvider';
export type {
  ToolDefinition as AnthropicToolDefinition,
  ToolUseResult,
  TextWithUsage,
} from './llm/AnthropicProvider';
export { GeminiProvider } from './llm/GeminiProvider';
export {
  LLMGateway,
  LLMGatewayError,
  RateLimitedError,
  ProviderUnavailableError,
  ContextWindowExceededError,
  EmptyResponseError,
  parseJSONFromLLMText,
} from './llm/LLMGateway';
export type {
  LLMTask,
  LLMRequest,
  LLMResponse,
  LLMUsage,
  LLMGatewayDeps,
  MetricsLike,
  SecretsLike,
  EventEmitterLike,
  CostTracker,
} from './llm/LLMGateway';
// tools SDK (ADR-T1/T3/T5) — the framework; domain tools live in domain repos
export type { ToolDefinition } from './tools/ToolDefinition';
export { ToolExecutionError, wrapToolError } from './tools/ToolError';
export type { ToolErrorCode, ToolErrorDetail, ToolOutput } from './tools/ToolError';
export { AGENT_CONTRACTS, getContractFor, validateContractsAgainstRegistry } from './tools/contracts';
export type { AgentContract } from './tools/contracts';
export { toolRegistry } from './tools/ToolRegistry';
export type { ToolContext } from './tools/ToolRegistry';
export { ToolsHandle, buildToolsHandle, resolveToolsForContext, setToolAuditDeps } from './tools/ToolsHandle';
export type { ToolManifest, TenantToolContext, ToolAuditWriter, DuplicateChecker } from './tools/ToolsHandle';
