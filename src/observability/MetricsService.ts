import * as prom from 'prom-client';

/**
 * Singleton Prometheus metrics registry for OpsFlow.
 *
 * All metrics use the `opsflow_` prefix and snake_case names.
 *
 * Usage:
 *   metrics.observe('http_request_duration_ms', 142, { method: 'POST', route: '/agent/queue/claim', status: '200' });
 *   metrics.increment('ticket_processed_total', { tenant_id: '...', outcome: 'auto_resolved' });
 *   metrics.set('escalation_queue_depth', 7, { tenant_id: '...' });
 */

// ── Metric name registry ───────────────────────────────────────────────────────

export type MetricName =
  // HTTP
  | 'http_request_duration_ms'
  // LLM (emitted by LLMGateway — Block 1)
  | 'llm_request_duration_ms'
  | 'llm_prompt_tokens_total'
  | 'llm_completion_tokens_total'
  | 'llm_cost_usd_total'
  | 'llm_failover_total'
  | 'llm_rate_limited_total'
  // Agent (emitted by dispatcher — Block 6)
  | 'agent_duration_ms'
  | 'agent_error_total'
  // Tool (emitted by ToolsHandle)
  | 'tool_duration_ms'
  | 'tool_error_total'
  // Queue (emitted by BullMQ workers)
  | 'queue_depth'
  | 'queue_job_duration_ms'
  // Database (emitted by repositories — Block 2)
  | 'db_query_duration_ms'
  // Business
  | 'ticket_processed_total'
  | 'escalation_queue_depth'
  | 'sla_breach_total'
  | 'invariant_violation_total'
  // Operational safety (ADR-081/082/083 — Block 8)
  | 'ai_halt_total'
  | 'circuit_breaker_tripped_total'
  | 'concurrency_requeued_total'
  // Deployment (Block 7)
  | 'shadow_drift_score'
  | 'shadow_runs_total'
  | 'deployment_promotions_total'
  | 'deployment_rollbacks_total'
  | 'deployment_auto_rollbacks_total';

type HistogramName = Extract<
  MetricName,
  | 'http_request_duration_ms'
  | 'llm_request_duration_ms'
  | 'agent_duration_ms'
  | 'tool_duration_ms'
  | 'queue_job_duration_ms'
  | 'db_query_duration_ms'
  | 'shadow_drift_score'
>;

type CounterName = Extract<
  MetricName,
  | 'llm_prompt_tokens_total'
  | 'llm_completion_tokens_total'
  | 'llm_cost_usd_total'
  | 'llm_failover_total'
  | 'llm_rate_limited_total'
  | 'agent_error_total'
  | 'tool_error_total'
  | 'ticket_processed_total'
  | 'sla_breach_total'
  | 'invariant_violation_total'
  | 'ai_halt_total'
  | 'circuit_breaker_tripped_total'
  | 'concurrency_requeued_total'
  | 'shadow_runs_total'
  | 'deployment_promotions_total'
  | 'deployment_rollbacks_total'
  | 'deployment_auto_rollbacks_total'
>;

type GaugeName = Extract<MetricName, 'queue_depth' | 'escalation_queue_depth'>;

// ── Label shapes per metric ────────────────────────────────────────────────────

const HISTOGRAM_CONFIGS: Record<HistogramName, { help: string; labelNames: string[]; buckets: number[] }> = {
  http_request_duration_ms: {
    help: 'HTTP request latency in milliseconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
  },
  llm_request_duration_ms: {
    help: 'LLM provider request latency in milliseconds',
    labelNames: ['provider', 'model', 'task', 'agent_id', 'tenant_id'],
    buckets: [250, 500, 1000, 2500, 5000, 10000, 20000, 30000],
  },
  agent_duration_ms: {
    help: 'Agent node execution latency in milliseconds',
    labelNames: ['agent_id', 'tenant_id'],
    buckets: [100, 250, 500, 1000, 2500, 5000, 10000, 30000],
  },
  tool_duration_ms: {
    help: 'Tool call latency in milliseconds',
    labelNames: ['tool_name', 'tenant_id', 'success'],
    buckets: [50, 100, 250, 500, 1000, 2500, 5000],
  },
  queue_job_duration_ms: {
    help: 'BullMQ job processing duration in milliseconds',
    labelNames: ['queue'],
    buckets: [100, 500, 1000, 5000, 10000, 30000, 60000],
  },
  db_query_duration_ms: {
    help: 'MongoDB query duration in milliseconds',
    labelNames: ['collection', 'operation', 'tenant_id'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500],
  },
  shadow_drift_score: {
    help: 'Drift score between production and shadow agent outputs (0–4)',
    labelNames: ['agent_id'],
    buckets: [0, 1, 2, 3, 4],
  },
};

const COUNTER_CONFIGS: Record<CounterName, { help: string; labelNames: string[] }> = {
  llm_prompt_tokens_total: {
    help: 'Total LLM prompt tokens consumed',
    labelNames: ['provider', 'model', 'task', 'agent_id', 'tenant_id'],
  },
  llm_completion_tokens_total: {
    help: 'Total LLM completion tokens generated',
    labelNames: ['provider', 'model', 'task', 'agent_id', 'tenant_id'],
  },
  llm_cost_usd_total: {
    help: 'Total LLM cost in USD',
    labelNames: ['provider', 'model', 'task', 'agent_id', 'tenant_id'],
  },
  agent_error_total: {
    help: 'Total agent node errors',
    labelNames: ['agent_id', 'tenant_id', 'error_type'],
  },
  tool_error_total: {
    help: 'Total tool call errors',
    labelNames: ['tool_name', 'tenant_id', 'error_type'],
  },
  ticket_processed_total: {
    help: 'Total tickets processed',
    labelNames: ['tenant_id', 'outcome'],
  },
  sla_breach_total: {
    help: 'Total SLA breaches',
    labelNames: ['tenant_id', 'urgency'],
  },
  invariant_violation_total: {
    help: 'Post-run invariant violations (§7 — a deterministic compliance gate was bypassed)',
    labelNames: ['tenant_id', 'invariant'],
  },
  ai_halt_total: {
    help: 'AI kill-switch transitions (ADR-081). action=halt|resume, source=manual|circuit_breaker, scope=global|tenant',
    labelNames: ['scope', 'source', 'action'],
  },
  circuit_breaker_tripped_total: {
    help: 'Pipeline circuit breaker trips (ADR-082) — error-rate spike auto-halted the AI',
    labelNames: ['scope', 'tenant_id'],
  },
  concurrency_requeued_total: {
    help: 'Runs requeued because the tenant hit its concurrency cap (ADR-083)',
    labelNames: ['tenant_id'],
  },
  llm_failover_total: {
    help: 'Total LLM calls served via failover provider (degraded mode)',
    labelNames: ['agent_id', 'tenant_id'],
  },
  llm_rate_limited_total: {
    help: 'Total LLM calls rejected by per-agent rate limiter',
    labelNames: ['agent_id', 'tenant_id'],
  },
  shadow_runs_total: {
    help: 'Total shadow agent runs executed',
    labelNames: ['agent_id'],
  },
  deployment_promotions_total: {
    help: 'Total agent version promotions',
    labelNames: ['agent_id'],
  },
  deployment_rollbacks_total: {
    help: 'Total manual agent version rollbacks',
    labelNames: ['agent_id'],
  },
  deployment_auto_rollbacks_total: {
    help: 'Total automatic agent version rollbacks triggered by error threshold',
    labelNames: ['agent_id'],
  },
};

const GAUGE_CONFIGS: Record<GaugeName, { help: string; labelNames: string[] }> = {
  queue_depth: {
    help: 'Current number of waiting jobs in a BullMQ queue',
    labelNames: ['queue'],
  },
  escalation_queue_depth: {
    help: 'Current number of pending escalations per tenant',
    labelNames: ['tenant_id'],
  },
};

// ── MetricsService ─────────────────────────────────────────────────────────────

export class MetricsService {
  private readonly registry: prom.Registry;
  private readonly histograms = new Map<HistogramName, prom.Histogram>();
  private readonly counters   = new Map<CounterName,   prom.Counter>();
  private readonly gauges     = new Map<GaugeName,     prom.Gauge>();

  constructor(registry?: prom.Registry) {
    // Allow injecting a fresh registry in tests to avoid cross-test pollution
    this.registry = registry ?? new prom.Registry();
    this._registerAll();
  }

  private _registerAll(): void {
    for (const [name, cfg] of Object.entries(HISTOGRAM_CONFIGS) as [HistogramName, typeof HISTOGRAM_CONFIGS[HistogramName]][]) {
      this.histograms.set(name, new prom.Histogram({
        name: `opsflow_${name}`,
        help: cfg.help,
        labelNames: cfg.labelNames,
        buckets: cfg.buckets,
        registers: [this.registry],
      }));
    }

    for (const [name, cfg] of Object.entries(COUNTER_CONFIGS) as [CounterName, typeof COUNTER_CONFIGS[CounterName]][]) {
      this.counters.set(name, new prom.Counter({
        name: `opsflow_${name}`,
        help: cfg.help,
        labelNames: cfg.labelNames,
        registers: [this.registry],
      }));
    }

    for (const [name, cfg] of Object.entries(GAUGE_CONFIGS) as [GaugeName, typeof GAUGE_CONFIGS[GaugeName]][]) {
      this.gauges.set(name, new prom.Gauge({
        name: `opsflow_${name}`,
        help: cfg.help,
        labelNames: cfg.labelNames,
        registers: [this.registry],
      }));
    }
  }

  /**
   * Record a latency/size observation into a histogram.
   * name must be a registered HistogramName.
   */
  observe(name: HistogramName, valueMs: number, labels?: Record<string, string>): void {
    const h = this.histograms.get(name);
    if (!h) return;
    labels ? h.observe(labels, valueMs) : h.observe(valueMs);
  }

  /**
   * Increment a counter by `by` (default 1).
   * name must be a registered CounterName.
   */
  increment(name: CounterName, labels?: Record<string, string>, by = 1): void {
    const c = this.counters.get(name);
    if (!c) return;
    labels ? c.inc(labels, by) : c.inc(by);
  }

  /**
   * Set a gauge to an absolute value.
   * name must be a registered GaugeName.
   */
  set(name: GaugeName, value: number, labels?: Record<string, string>): void {
    const g = this.gauges.get(name);
    if (!g) return;
    labels ? g.set(labels, value) : g.set(value);
  }

  /** Returns the Prometheus text exposition for the /metrics endpoint. */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content type required by Prometheus scrapers. */
  get contentType(): string {
    return this.registry.contentType;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const metrics = new MetricsService();
