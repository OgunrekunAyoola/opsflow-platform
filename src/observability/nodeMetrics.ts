import { metrics } from './MetricsService';
import { runWithAgent } from '../shared/utils/correlationContext';

type AnyNodeFn<S extends { tenantId: string }, U> = (state: S) => U | Promise<U>;

/**
 * Wraps a LangGraph node function so that every invocation:
 * - Sets the executing agent in the correlation context (agent-attributed I/O — N-68)
 * - Emits the agent_duration_ms histogram
 * - Increments agent_error_total on uncaught errors
 *
 * Tracing is NOT done here — LangSmith traces the LangGraph pipeline natively
 * (ADR-079; founder directive: don't build for tools that already exist). The
 * previous OpenTelemetry per-node span was drift and was removed (N-73).
 */
export function withNodeMetrics<S extends { tenantId: string }, U>(
  agentId: string,
  fn: AnyNodeFn<S, U>,
): AnyNodeFn<S, U> {
  return async (state: S): Promise<U> => {
    const start = Date.now();
    const labels = { agent_id: agentId, tenant_id: state.tenantId };
    try {
      const result = await runWithAgent(agentId, () => fn(state));
      metrics.observe('agent_duration_ms', Date.now() - start, labels);
      return result;
    } catch (err: any) {
      metrics.observe('agent_duration_ms', Date.now() - start, labels);
      metrics.increment('agent_error_total', {
        ...labels,
        error_type: err?.constructor?.name ?? 'Error',
      });
      throw err;
    }
  };
}
