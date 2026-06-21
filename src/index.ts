/**
 * @opsflow/platform — the Data plane SDK. Depends on @opsflow/contracts.
 * Dependency direction: contracts → platform → (orchestrator, pipelines, agents, apps).
 *
 * Extraction is phased (P2 sub-slices). Current surface:
 *  - observability: MetricsService (`metrics`, Prometheus) + withNodeMetrics
 *    (tracing is LangSmith, native to LangGraph — ADR-079; no custom tracing)
 *  - secrets: SecretsProvider interface + EnvSecretsProvider + `secrets` singleton
 * (models, repositories, LLM gateway, event bus, PII, tools SDK follow in later slices.)
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
export type { DomainEvent, DomainEventName, EventHandler, SubscriberOptions, IEventBus } from './events/DomainEvent';
export { BullMQEventBus } from './events/EventBus';
export type { EventBusDeps, EventLogStore, EventQueue, EventRedis } from './events/EventBus';
export { computeLlmCostUsd } from './llm/cost';
export type { LLMProvider, ProviderMasker, CallLogger, ProviderDeps } from './llm/LLMProvider';
export { ModelRouter } from './llm/ModelRouter';
export { AnthropicProvider } from './llm/AnthropicProvider';
export type { ToolDefinition, ToolUseResult, TextWithUsage } from './llm/AnthropicProvider';
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
