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
