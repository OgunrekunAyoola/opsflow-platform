import { trace, SpanStatusCode } from '@opentelemetry/api';
import { metrics } from './MetricsService';
import { runWithAgent } from '../shared/utils/correlationContext';

const tracer = trace.getTracer('opsflow.graph-nodes');

type AnyNodeFn<S extends { tenantId: string }, U> = (state: S) => U | Promise<U>;

/**
 * Wraps a LangGraph node function so that every invocation:
 * - Opens an OpenTelemetry span for the node execution
 * - Sets the executing agent in the correlation context (agent-attributed I/O — N-68)
 * - Emits agent_duration_ms histogram
 * - Increments agent_error_total on uncaught errors
 */
export function withNodeMetrics<S extends { tenantId: string }, U>(
  agentId: string,
  fn: AnyNodeFn<S, U>,
): AnyNodeFn<S, U> {
  return (state: S): Promise<U> =>
    tracer.startActiveSpan(`agent.node/${agentId}`, async (span) => {
      span.setAttributes({ 'agent.id': agentId, 'agent.tenant_id': state.tenantId });
      const start = Date.now();
      const labels = { agent_id: agentId, tenant_id: state.tenantId };
      try {
        const result = await runWithAgent(agentId, () => fn(state));
        metrics.observe('agent_duration_ms', Date.now() - start, labels);
        span.end();
        return result;
      } catch (err: any) {
        metrics.observe('agent_duration_ms', Date.now() - start, labels);
        metrics.increment('agent_error_total', {
          ...labels,
          error_type: err?.constructor?.name ?? 'Error',
        });
        span.setStatus({ code: SpanStatusCode.ERROR, message: err?.message });
        span.end();
        throw err;
      }
    });
}
