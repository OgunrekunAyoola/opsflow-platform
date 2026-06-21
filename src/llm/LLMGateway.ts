import { randomUUID } from 'crypto';
import type Anthropic from '@anthropic-ai/sdk';
import type { ToolDefinition } from './AnthropicProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GeminiProvider } from './GeminiProvider';
import { PIIMaskingUnavailableError } from '../pii/PIIMasker';
import { metrics as defaultMetrics } from '../observability/MetricsService';
import { getRedisClient } from '../infra/redis';
type Redis = NonNullable<ReturnType<typeof getRedisClient>>;
import logger from '../shared/utils/logger';
import { getCorrelation as defaultGetCorrelation } from '../shared/utils/correlationContext';
import { secrets as defaultSecrets } from '../secrets';
import { computeLlmCostUsd } from './cost';
import { makeDomainEvent as defaultMakeDomainEvent } from '../events/DomainEvent';

// ── Types ──────────────────────────────────────────────────────────────────────

export type LLMTask =
  | 'classification'    // Gemini Flash — triage, thread classification
  | 'self_eval'         // Gemini Flash — quality scoring
  | 'summary'           // Gemini Flash — thread summary generation
  | 'answer_generation' // Claude Sonnet — draft response
  | 'memory_extraction' // Claude Sonnet — fact extraction
  | 'tool_use';         // Claude Sonnet — multi-turn tool use loop

export interface LLMRequest {
  task: LLMTask;
  tenantId: string;
  /** Identifies the calling node — used for per-agent metrics and rate limiting. */
  agentId: string;
  ticketId?: string;
  /**
   * Simple single-turn prompt. Mutually exclusive with messages.
   * For systemPrompt + prompt, pass both fields — gateway concatenates them.
   */
  prompt?: string;
  systemPrompt?: string;
  /**
   * Multi-turn conversation history. Only used for task: 'tool_use'
   * (ResolutionAgentNode's iterative tool loop).
   */
  messages?: Anthropic.MessageParam[];
  /** Tool definitions in Anthropic tool_use format. */
  tools?: ToolDefinition[];
  maxTokens?: number;
  /**
   * Step 3 — tenant billing tier. When supplied, the gateway enforces the daily
   * budget cap before the provider call. Omit only in background/offline jobs where
   * the pre-flight AgentGraph check already covers enforcement.
   */
  tenantTier?: string;
  /** Tenant.dailyLlmBudgetUsd override — lowers the tier cap, never raises it (ADR-041). */
  tenantBudgetUsd?: number;
  /**
   * Step 4 — dedup key. When set on a cacheable task (classification, summary),
   * gateway returns the cached response if an identical key was used within 30s.
   */
  dedupKey?: string;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalCostUsd: number;
}

export interface LLMResponse {
  text: string;
  /** Populated only when the model returned tool calls. */
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  /**
   * Raw Anthropic content blocks — needed by ResolutionAgentNode to append the
   * assistant turn to the conversation history before the next iteration.
   */
  rawContent?: Anthropic.ContentBlock[];
  stopReason?: string;
  provider: 'anthropic' | 'gemini';
  model: string;
  usage: LLMUsage;
  latencyMs: number;
  /** True when served from failover provider (Step 6). */
  degraded: boolean;
  /** True when served from dedup cache (Step 4). */
  cacheHit: boolean;
  requestId: string;
}

// ── Host collaborators (injected) ──────────────────────────────────────────────
// The gateway is sacred infra: it constructs providers, emits domain events for cost
// attribution, enforces the budget gate, and emits metrics. Those collaborators are
// injected so platform never reaches into the host's event bus / cost service, and so
// tests can supply mocks. Defaults wire platform's own singletons; the budget gate +
// event bus default to no-ops (the host shim ALWAYS injects the real ones in prod).

export interface MetricsLike {
  increment(name: string, labels?: Record<string, string>, value?: number): void;
  observe(name: string, value: number, labels?: Record<string, string>): void;
}
export interface SecretsLike {
  getOptional(scope: string, key: string): Promise<string | null>;
}
export interface EventEmitterLike {
  emit(event: unknown): Promise<void>;
}
export interface CostTracker {
  assertBudget(tenantId: string, tier: string, overrideUsd?: number | null): Promise<void>;
  incrementDailySpend(tenantId: string, costUsd: number): Promise<void>;
}
export interface LLMGatewayDeps {
  anthropicFactory?: (apiKey: string) => AnthropicProvider;
  geminiFactory?: () => GeminiProvider;
  metrics?: MetricsLike;
  secrets?: SecretsLike;
  eventBus?: EventEmitterLike;
  costTracker?: CostTracker;
  makeDomainEvent?: typeof defaultMakeDomainEvent;
  getCorrelation?: () => { correlationId?: string };
}

const noopEventBus: EventEmitterLike = { emit: async () => undefined };
const noopCostTracker: CostTracker = {
  assertBudget: async () => undefined,
  incrementDailySpend: async () => undefined,
};

// ── Error types ────────────────────────────────────────────────────────────────

export class LLMGatewayError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'LLMGatewayError';
  }
}

export class RateLimitedError extends Error {
  constructor(public readonly agentId: string, public readonly tenantId: string) {
    super(`Rate limit exceeded for agent ${agentId} on tenant ${tenantId}`);
    this.name = 'RateLimitedError';
  }
}

export class ProviderUnavailableError extends Error {
  constructor(public readonly provider: string, public readonly model: string) {
    super(`Provider ${provider}/${model} is unavailable (circuit open)`);
    this.name = 'ProviderUnavailableError';
  }
}

export class ContextWindowExceededError extends Error {
  constructor(
    public readonly estimatedTokens: number,
    public readonly limitTokens: number,
    public readonly model: string,
  ) {
    super(
      `Prompt too large for ${model}: estimated ${estimatedTokens} tokens exceeds limit of ${limitTokens}`,
    );
    this.name = 'ContextWindowExceededError';
  }
}

export class EmptyResponseError extends Error {
  constructor(public readonly provider: string, public readonly task: string) {
    super(`Provider ${provider} returned an empty response for task ${task}`);
    this.name = 'EmptyResponseError';
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Tasks whose responses are deterministic enough to be safely dedup-cached. */
const CACHEABLE_TASKS = new Set<LLMTask>(['classification', 'summary']);

/** ADR-027 provider routing table. */
const TASK_PROVIDER: Record<LLMTask, 'anthropic' | 'gemini'> = {
  classification:    'gemini',
  self_eval:         'gemini',
  summary:           'gemini',
  answer_generation: 'anthropic',
  memory_extraction: 'anthropic',
  tool_use:          'anthropic',
};

/**
 * When failing over from Anthropic to Gemini, remap tasks that Gemini's
 * ModelRouter can't handle directly (tool_use, memory_extraction → answer_generation).
 */
const FAILOVER_TASK_MAP: Partial<Record<LLMTask, LLMTask>> = {
  tool_use:          'answer_generation',
  memory_extraction: 'answer_generation',
};

const DEDUP_TTL_S          = 30;
const RATE_LIMIT_MAX       = 30;   // requests per 60-second window
const RATE_LIMIT_WINDOW_S  = 60;
const CIRCUIT_THRESHOLD    = 5;    // consecutive failures before opening
const CIRCUIT_OPEN_MS      = 30_000; // 30 s open window

/**
 * ADR-075 — context window limits per model.
 * We validate against (limit - max_tokens) so output budget is never consumed
 * by a prompt that already fills the window.
 */
const CONTEXT_WINDOW_TOKENS: Record<string, number> = {
  'claude-sonnet-4-6':       200_000,
  'claude-opus-4-7':         200_000,
  'claude-haiku-4-5-20251001': 200_000,
  'gemini-2.5-flash':        1_048_576,
  'gemini-2.5-pro':          1_048_576,
  'gemini-1.5-flash':        1_048_576,
  'gemini-1.5-pro':          2_097_152,
};
const OUTPUT_BUDGET_TOKENS = 4_096; // matches max_tokens in both providers

// ── Internal type alias ───────────────────────────────────────────────────────

type RawLLMResponse = Omit<LLMResponse, 'provider' | 'latencyMs' | 'degraded' | 'cacheHit' | 'requestId'>;

// ── JSON extraction helper ────────────────────────────────────────────────────

/**
 * Extracts and parses JSON from an LLM text response.
 * Handles markdown code block wrapping (```json...``` or ```...```) and raw JSON.
 */
export function parseJSONFromLLMText<T = unknown>(text: string): T {
  const fenced =
    text.match(/```json\s*([\s\S]*?)\s*```/) ||
    text.match(/```\s*([\s\S]*?)\s*```/);
  return JSON.parse(fenced ? fenced[1] : text.trim()) as T;
}

// ── LLMGateway ────────────────────────────────────────────────────────────────

export class LLMGateway {
  private readonly _injectedAnthropic?: AnthropicProvider;
  private readonly _injectedGemini?: GeminiProvider;
  private _gemini?: GeminiProvider;
  // undefined = lazy-init from getRedisClient(); null = explicitly no Redis (tests)
  private _redis: Redis | null | undefined;
  // Per-agent key cache: API key → provider instance (Block 5 Step 3)
  private readonly _anthropicCache = new Map<string, AnthropicProvider>();

  // Injected host collaborators (defaults wire platform singletons / no-ops).
  private readonly _anthropicFactory: (apiKey: string) => AnthropicProvider;
  private readonly _geminiFactory: () => GeminiProvider;
  private readonly _metrics: MetricsLike;
  private readonly _secrets: SecretsLike;
  private readonly _eventBus: EventEmitterLike;
  private readonly _costTracker: CostTracker;
  private readonly _makeDomainEvent: typeof defaultMakeDomainEvent;
  private readonly _getCorrelation: () => { correlationId?: string };

  constructor(anthropic?: AnthropicProvider, gemini?: GeminiProvider, redis?: Redis | null, deps: LLMGatewayDeps = {}) {
    this._injectedAnthropic = anthropic;
    this._injectedGemini    = gemini;
    if (redis !== undefined) this._redis = redis;

    this._anthropicFactory = deps.anthropicFactory ?? ((apiKey: string) => new AnthropicProvider(apiKey));
    this._geminiFactory    = deps.geminiFactory    ?? (() => new GeminiProvider());
    this._metrics          = deps.metrics          ?? defaultMetrics;
    this._secrets          = deps.secrets          ?? defaultSecrets;
    this._eventBus         = deps.eventBus         ?? noopEventBus;
    this._costTracker      = deps.costTracker      ?? noopCostTracker;
    this._makeDomainEvent  = deps.makeDomainEvent  ?? defaultMakeDomainEvent;
    this._getCorrelation   = deps.getCorrelation   ?? defaultGetCorrelation;
  }

  private get gemini(): GeminiProvider {
    if (!this._gemini) this._gemini = this._injectedGemini ?? this._geminiFactory();
    return this._gemini;
  }

  private get redis(): Redis | null {
    if (this._redis === undefined) this._redis = getRedisClient();
    return this._redis;
  }

  // ── Public entry point ──────────────────────────────────────────────────────

  async complete(req: LLMRequest): Promise<LLMResponse> {
    if (!req.prompt && !req.messages) {
      throw new LLMGatewayError('LLMRequest requires either prompt or messages');
    }
    // Tracing is LangSmith (native to @langchain/langgraph), per ADR-079 — no custom
    // OpenTelemetry spans here (N-73).
    return this._complete(req);
  }

  private async _complete(req: LLMRequest): Promise<LLMResponse> {
    const requestId = randomUUID();
    const startMs   = Date.now();
    const meta      = { tenantId: req.tenantId, ticketId: req.ticketId };

    // Step 4: dedup cache check (cacheable tasks only)
    if (req.dedupKey && CACHEABLE_TASKS.has(req.task)) {
      const cached = await this._dedupGet(req.tenantId, req.dedupKey);
      if (cached) {
        return { ...cached, cacheHit: true, requestId, latencyMs: Date.now() - startMs };
      }
    }

    // Step 3: per-tenant budget gate (ADR-041) — only when tier is known
    if (req.tenantTier) {
      await this._costTracker.assertBudget(req.tenantId, req.tenantTier, req.tenantBudgetUsd);
    }

    // Step 5: per-agent rate limit
    await this._checkRateLimit(req.tenantId, req.agentId);

    let primaryProvider = TASK_PROVIDER[req.task] ?? 'gemini';

    // Measurement/offline mode: LLM_FORCE_PROVIDER=gemini routes Anthropic-native
    // tasks straight to Gemini (same task remap as failover) without burning two
    // failed Anthropic attempts or tripping the circuit breaker. Exists for
    // cost-measurement runs when no Anthropic key is provisioned.
    // HARD GUARD: ignored in production — an env var must never silently change
    // ADR-027 routing in prod (env-sniffing class E1).
    let effectiveReq = req;
    if (primaryProvider === 'anthropic' && process.env.LLM_FORCE_PROVIDER === 'gemini') {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[LLMGateway] LLM_FORCE_PROVIDER=gemini is set in PRODUCTION — ignored. Measurement mode only; unset this variable.');
      } else {
        primaryProvider = 'gemini';
        effectiveReq = { ...req, task: FAILOVER_TASK_MAP[req.task] ?? req.task };
      }
    }

    // Single-provider mode (mirror of the above): LLM_FORCE_PROVIDER=anthropic routes
    // Gemini-native tasks (classification/self_eval/summary) onto Anthropic. Used when
    // only an Anthropic key is provisioned (Gemini removed/expired). Anthropic handles
    // these tasks directly — _buildPrompt is provider-agnostic — so no task remap is
    // needed. Same hard guard: an env var must never silently change ADR-027 routing
    // in production (env-sniffing class E1).
    if (primaryProvider === 'gemini' && process.env.LLM_FORCE_PROVIDER === 'anthropic') {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[LLMGateway] LLM_FORCE_PROVIDER=anthropic is set in PRODUCTION — ignored. Single-provider/measurement mode only; unset this variable.');
      } else {
        primaryProvider = 'anthropic';
      }
    }

    // ADR-075: context window validation — fail fast before burning an API call.
    // Validated on effectiveReq, AFTER any force-provider remap: the remapped task
    // selects a different model with a different window (a 250k-token prompt is
    // over Sonnet's limit but fine for Gemini in measurement mode).
    this._validateContextWindow(effectiveReq);

    let raw: RawLLMResponse;
    let usedProvider: 'anthropic' | 'gemini';
    let degraded: boolean;

    try {
      ({ raw, usedProvider, degraded } = await this._executeWithFailover(effectiveReq, meta, primaryProvider));
    } catch (err: any) {
      const latencyMs = Date.now() - startMs;
      logger.warn(`[LLMGateway] Call failed — task=${req.task} agent=${req.agentId} latency=${latencyMs}ms error=${err.message}`);
      this._metrics.increment('agent_error_total', {
        agent_id:   req.agentId,
        tenant_id:  req.tenantId,
        error_type: err.constructor?.name ?? 'Error',
      });
      throw err;
    }

    const latencyMs = Date.now() - startMs;
    this._emitMetrics(req, usedProvider, raw.model, raw.usage, latencyMs);
    if (degraded) {
      this._metrics.increment('llm_failover_total', { agent_id: req.agentId, tenant_id: req.tenantId });
    }

    const response: LLMResponse = {
      ...raw,
      provider: usedProvider,
      latencyMs,
      degraded,
      cacheHit: false,
      requestId,
    };

    // Step 4: write dedup cache after successful call (fire-and-forget)
    if (req.dedupKey && CACHEABLE_TASKS.has(req.task)) {
      this._dedupSet(req.tenantId, req.dedupKey, response).catch(() => {});
    }

    // Budget counter: bump the Redis daily-spend counter SYNCHRONOUSLY in-process
    // so the ADR-041 gate reads a current number (the durable CostLedger row is
    // written async by the LLMCallCompleted subscriber — single writer per store,
    // audit N-36). Fire-and-forget: never block the call path.
    if (raw.usage.totalCostUsd > 0) {
      this._costTracker.incrementDailySpend(req.tenantId, raw.usage.totalCostUsd).catch(() => {});
    }

    // Emit LLMCallCompleted — the subscriber writes the durable cost ledger (the
    // single ledger writer; providers no longer record cost — audit N-36).
    this._eventBus.emit(this._makeDomainEvent(
      'LLMCallCompleted',
      req.tenantId,
      req.ticketId ?? req.tenantId,
      {
        tenantId:         req.tenantId,
        ticketId:         req.ticketId,
        agentId:          req.agentId,
        task:             req.task,
        provider:         usedProvider,
        model:            raw.model,
        latencyMs,
        promptTokens:     raw.usage.promptTokens,
        completionTokens: raw.usage.completionTokens,
        totalCostUsd:     raw.usage.totalCostUsd,
        degraded,
      },
      this._getCorrelation().correlationId,
    )).catch(() => {}); // fire-and-forget — never block the LLM call path

    return response;
  }

  // ── Steps 6 + 7: failover + circuit breaker ─────────────────────────────────

  private async _executeWithFailover(
    req: LLMRequest,
    meta: { tenantId: string; ticketId?: string },
    primaryProvider: 'anthropic' | 'gemini',
  ): Promise<{ raw: RawLLMResponse; usedProvider: 'anthropic' | 'gemini'; degraded: boolean }> {
    const primaryModel = primaryProvider === 'anthropic'
      ? (process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6')
      : (process.env.MODEL_CLASSIFICATION ?? 'gemini-2.5-flash');

    const callPrimary = (): Promise<RawLLMResponse> =>
      primaryProvider === 'anthropic'
        ? this._callAnthropic(req, meta)
        : this._callGemini(req, meta);

    // Step 7: if circuit is open, skip primary and go straight to failover
    if (await this._isCircuitOpen(primaryProvider, primaryModel)) {
      logger.warn(`[LLMGateway] Circuit open for ${primaryProvider}/${primaryModel} — routing to failover`);
      return this._callFailover(req, meta, primaryProvider, primaryModel);
    }

    // Try primary provider — up to 2 attempts (Step 6 retry)
    let lastErr: any;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await callPrimary();
        this._validateResponse(raw, primaryProvider, req.task);
        await this._circuitSuccess(primaryProvider, primaryModel);
        return { raw, usedProvider: primaryProvider, degraded: false };
      } catch (err: any) {
        // Failure Policy: masking unavailability is NOT a provider failure — the
        // failover provider shares the same masker, and counting it would open
        // the circuit for a healthy LLM. Propagate immediately, no retry/failover.
        if (err instanceof PIIMaskingUnavailableError) throw err;
        lastErr = err;
        await this._circuitFailure(primaryProvider, primaryModel);
        logger.warn(
          `[LLMGateway] ${primaryProvider} attempt ${attempt}/2 failed: ${err.message}`,
        );
      }
    }

    // Both attempts failed — try failover for Anthropic primary (Step 6)
    if (primaryProvider === 'anthropic') {
      logger.warn('[LLMGateway] Anthropic failed twice — falling over to Gemini (degraded)');
      return this._callFailover(req, meta, primaryProvider, primaryModel);
    }

    // No failover for Gemini tasks
    throw lastErr;
  }

  private async _callFailover(
    req: LLMRequest,
    meta: { tenantId: string; ticketId?: string },
    failedProvider: 'anthropic' | 'gemini',
    failedModel: string,
  ): Promise<{ raw: RawLLMResponse; usedProvider: 'anthropic' | 'gemini'; degraded: boolean }> {
    if (failedProvider !== 'anthropic') {
      throw new ProviderUnavailableError(failedProvider, failedModel);
    }
    // Remap task so Gemini's ModelRouter can handle it
    const fallbackTask: LLMTask = FAILOVER_TASK_MAP[req.task] ?? req.task;
    const fallbackReq: LLMRequest = { ...req, task: fallbackTask };
    const raw = await this._callGemini(fallbackReq, meta);
    this._validateResponse(raw, 'gemini', req.task);
    return { raw, usedProvider: 'gemini', degraded: true };
  }

  // ── ADR-075: provider contracts ─────────────────────────────────────────────

  /**
   * Estimates prompt token count and throws ContextWindowExceededError if it
   * would overflow the model's context window (minus output budget).
   *
   * Heuristic: 1 token ≈ 3.5 characters. This overestimates for pure ASCII
   * (safe — we prefer a false reject over a silent truncation).
   */
  private _validateContextWindow(req: LLMRequest): void {
    const model =
      TASK_PROVIDER[req.task] === 'anthropic'
        ? (process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6')
        : (process.env.MODEL_CLASSIFICATION ?? 'gemini-2.5-flash');

    const limit = CONTEXT_WINDOW_TOKENS[model];
    if (!limit) return; // unknown model — skip check rather than false-reject

    const usableTokens = limit - OUTPUT_BUDGET_TOKENS;

    // Estimate from messages array or prompt string
    let charCount = 0;
    if (req.messages) {
      for (const m of req.messages) {
        if (typeof m.content === 'string') {
          charCount += m.content.length;
        } else if (Array.isArray(m.content)) {
          for (const block of m.content) {
            if ('text' in block) charCount += (block as { text: string }).text.length;
          }
        }
      }
    } else {
      charCount += (req.prompt?.length ?? 0) + (req.systemPrompt?.length ?? 0);
    }

    const estimatedTokens = Math.ceil(charCount / 3.5);
    if (estimatedTokens > usableTokens) {
      throw new ContextWindowExceededError(estimatedTokens, usableTokens, model);
    }
  }

  /**
   * Validates that the provider returned a non-empty response.
   * An empty text with no tool calls is a sign of content filtering or a
   * provider-side issue — treat it as a retriable error so the circuit breaker
   * and failover logic can handle it.
   */
  private _validateResponse(raw: RawLLMResponse, provider: string, task: LLMTask): void {
    const hasText = typeof raw.text === 'string' && raw.text.trim().length > 0;
    const hasToolCalls = Array.isArray(raw.toolCalls) && raw.toolCalls.length > 0;
    if (!hasText && !hasToolCalls) {
      throw new EmptyResponseError(provider, task);
    }
  }

  // ── Step 7: circuit breaker (Redis-backed) ──────────────────────────────────

  private async _isCircuitOpen(provider: string, model: string): Promise<boolean> {
    const r = this.redis;
    if (!r) return false;
    const val = await r.get(`cb:open_until:${provider}:${model}`).catch(() => null);
    if (!val) return false;
    return Date.now() < parseInt(val, 10);
  }

  private async _circuitSuccess(provider: string, model: string): Promise<void> {
    const r = this.redis;
    if (!r) return;
    await r.del(`cb:failures:${provider}:${model}`).catch(() => {});
  }

  private async _circuitFailure(provider: string, model: string): Promise<void> {
    const r = this.redis;
    if (!r) return;
    const failKey = `cb:failures:${provider}:${model}`;
    const count   = await r.incr(failKey).catch(() => 0);
    await r.expire(failKey, 60).catch(() => {}); // auto-reset if quiet for 60s
    if (count >= CIRCUIT_THRESHOLD) {
      const openUntil = Date.now() + CIRCUIT_OPEN_MS;
      await r
        .set(`cb:open_until:${provider}:${model}`, String(openUntil), 'EX', Math.ceil(CIRCUIT_OPEN_MS / 1000) + 5)
        .catch(() => {});
      logger.warn(
        `[LLMGateway] Circuit opened for ${provider}/${model} — open until ${new Date(openUntil).toISOString()}`,
      );
    }
  }

  // ── Step 4: dedup cache ──────────────────────────────────────────────────────

  private async _dedupGet(tenantId: string, dedupKey: string): Promise<LLMResponse | null> {
    const r = this.redis;
    if (!r) return null;
    const raw = await r.get(`llmcache:${tenantId}:${dedupKey}`).catch(() => null);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LLMResponse;
    } catch {
      return null;
    }
  }

  private async _dedupSet(tenantId: string, dedupKey: string, response: LLMResponse): Promise<void> {
    const r = this.redis;
    if (!r) return;
    await r.set(
      `llmcache:${tenantId}:${dedupKey}`,
      JSON.stringify(response),
      'EX',
      DEDUP_TTL_S,
    ).catch(() => {});
  }

  // ── Step 5: per-agent rate limiter ──────────────────────────────────────────

  private async _checkRateLimit(tenantId: string, agentId: string): Promise<void> {
    const r = this.redis;
    if (!r) return;
    const minute = Math.floor(Date.now() / 60_000);
    const key    = `ratelimit:${tenantId}:${agentId}:${minute}`;
    const count  = await r.incr(key).catch(() => 0);
    if (count === 1) {
      // First request in this window — set TTL to 2× window so the key auto-expires
      await r.expire(key, RATE_LIMIT_WINDOW_S * 2).catch(() => {});
    }
    if (count > RATE_LIMIT_MAX) {
      this._metrics.increment('llm_rate_limited_total', { agent_id: agentId, tenant_id: tenantId });
      throw new RateLimitedError(agentId, tenantId);
    }
  }

  // ── Internal call paths ─────────────────────────────────────────────────────

  /**
   * Resolves the Anthropic provider for a given agent (Block 5 Step 3).
   * Priority: injected (test) → per-agent scoped key → global ANTHROPIC_API_KEY.
   * Providers are cached by resolved key so the SDK client is created at most once
   * per unique key value, even across many concurrent requests.
   */
  private async _getAnthropicProvider(agentId: string): Promise<AnthropicProvider> {
    if (this._injectedAnthropic) return this._injectedAnthropic;

    const scopedKey = await this._secrets.getOptional(`agent:${agentId}:llm`, 'ANTHROPIC_API_KEY');
    const key = scopedKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    if (!key) throw new LLMGatewayError(`ANTHROPIC_API_KEY not configured for agent ${agentId}`);

    let provider = this._anthropicCache.get(key);
    if (!provider) {
      provider = this._anthropicFactory(key);
      this._anthropicCache.set(key, provider);
    }
    return provider;
  }

  private async _callAnthropic(
    req: LLMRequest,
    meta: { tenantId: string; ticketId?: string },
  ): Promise<RawLLMResponse> {
    const model    = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
    const provider = await this._getAnthropicProvider(req.agentId);

    if (req.tools?.length && req.messages) {
      const result = await provider.generateWithTools(
        req.task,
        req.systemPrompt ?? '',
        req.messages,
        req.tools,
        meta,
      );
      return {
        text:       result.text,
        toolCalls:  result.toolCalls,
        rawContent: result.rawContent,
        stopReason: result.stopReason,
        model,
        usage: this._usage(model, result.promptTokens, result.completionTokens),
      };
    }

    const prompt = this._buildPrompt(req);
    const { text, promptTokens, completionTokens } = await provider.generateTextWithUsage(req.task, prompt, meta);
    return {
      text,
      model,
      usage: this._usage(model, promptTokens, completionTokens),
    };
  }

  private async _callGemini(
    req: LLMRequest,
    meta: { tenantId: string; ticketId?: string },
  ): Promise<RawLLMResponse> {
    const prompt = this._buildPrompt(req);
    // Use the model the provider ACTUALLY served (ModelRouter picks it per task),
    // not a hardcoded MODEL_CLASSIFICATION guess — otherwise a failover/forced
    // answer_generation call (gemini-2.5-pro) was mislabelled+undercosted as
    // gemini-2.5-flash, so the event/metrics disagreed with the ledger (audit S-06).
    const { text, promptTokens, completionTokens, model } =
      await this.gemini.generateTextWithUsage(req.task, prompt, meta);
    return {
      text,
      model,
      usage: this._usage(model, promptTokens, completionTokens),
    };
  }

  /**
   * Builds the usage object surfaced in LLMResponse, metrics, and the
   * LLMCallCompleted event. Cost is computed here (gateway owns cost attribution).
   * The ledger write happens exactly once — in the LLMCallCompleted subscriber,
   * keyed off this event. Providers no longer write the ledger (audit N-36: that
   * was the second writer that double-counted every call).
   */
  private _usage(model: string, promptTokens: number, completionTokens: number): LLMUsage {
    return {
      promptTokens,
      completionTokens,
      totalCostUsd: computeLlmCostUsd(model, promptTokens, completionTokens),
    };
  }

  private _buildPrompt(req: LLMRequest): string {
    if (req.systemPrompt && req.prompt) return `${req.systemPrompt}\n\n${req.prompt}`;
    if (req.prompt || !req.messages) return req.prompt ?? req.systemPrompt ?? '';

    // messages-only request (tool_use loop) landing on the Gemini text path —
    // failover or LLM_FORCE_PROVIDER. Flatten the conversation so the model
    // actually sees it instead of just the system prompt.
    const parts: string[] = [];
    if (req.systemPrompt) parts.push(req.systemPrompt);
    for (const m of req.messages) {
      const text = typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content
              .map((b) => ('text' in b ? (b as { text: string }).text : ''))
              .filter(Boolean)
              .join('\n')
          : '';
      if (text) parts.push(`${m.role}: ${text}`);
    }
    return parts.join('\n\n');
  }

  private _emitMetrics(
    req: LLMRequest,
    provider: 'anthropic' | 'gemini',
    model: string,
    usage: LLMUsage,
    latencyMs: number,
  ): void {
    const labels = {
      provider,
      model,
      task:      req.task,
      agent_id:  req.agentId,
      tenant_id: req.tenantId,
    };

    this._metrics.observe('llm_request_duration_ms', latencyMs, labels);

    if (usage.promptTokens > 0)     this._metrics.increment('llm_prompt_tokens_total',     labels, usage.promptTokens);
    if (usage.completionTokens > 0) this._metrics.increment('llm_completion_tokens_total', labels, usage.completionTokens);
    if (usage.totalCostUsd > 0)     this._metrics.increment('llm_cost_usd_total',          labels, usage.totalCostUsd);
  }
}
