import { createHash } from 'crypto';
import type { ToolDefinition } from './ToolDefinition';
import type { ToolOutput } from './ToolError';
import { wrapToolError } from './ToolError';
import { metrics } from '../observability/MetricsService';
import logger from '../shared/utils/logger';

// ── Host-injected audit collaborators ──────────────────────────────────────────
// The handle writes an audit row on every tool execution (ADR-032) and checks
// idempotency for mutating tools (ADR-T5). Both are host concerns (AuditService +
// the AuditLog model / mongoose), injected at boot so platform stays model-free.

export interface ToolAuditWriter {
  log(entry: {
    tenantId: string;
    ticketId: string;
    actor: string;
    action: string;
    metadata: Record<string, unknown>;
  }): Promise<unknown>;
}
/** Returns true if a prior audit row already recorded this invocation (duplicate). */
export type DuplicateChecker = (tenantId: string, action: string, invocationId: string) => Promise<boolean>;

let _auditWriter: ToolAuditWriter = { log: async () => undefined };
let _checkDuplicate: DuplicateChecker = async () => false;

/** Called once by the host at boot to wire the real audit service + idempotency check. */
export function setToolAuditDeps(deps: {
  auditWriter: ToolAuditWriter;
  checkDuplicate: DuplicateChecker;
}): void {
  _auditWriter = deps.auditWriter;
  _checkDuplicate = deps.checkDuplicate;
}

// ADR-T1: frozen context injected per tool — no agent may hold a live credential ref
export interface TenantToolContext {
  readonly tenantId: string;
  readonly ticketId: string;
  readonly credentials: Readonly<Record<string, string>>;
  readonly toolConfig: Readonly<Record<string, unknown>>;
}

interface ToolEntry {
  tool: ToolDefinition;
  ctx: TenantToolContext;
}

export class ToolsHandle {
  private registry: Map<string, ToolEntry>;

  constructor(tools: ToolEntry[]) {
    this.registry = new Map(tools.map((t) => [t.tool.name, t]));
    Object.freeze(this);
  }

  get toolNames(): string[] {
    return [...this.registry.keys()];
  }

  /**
   * ADR-T5: generates invocationId per call, checks idempotency for mutating tools,
   * writes audit on every execution.
   */
  async call(name: string, input: Record<string, unknown>): Promise<ToolOutput> {
    const entry = this.registry.get(name);
    if (!entry) {
      return {
        success: false,
        data: null,
        errors: [{ code: 'TOOL_NOT_FOUND', message: `Tool "${name}" not in handle`, retryable: false }],
      };
    }

    const { tool, ctx } = entry;

    // ADR-T5: deterministic idempotency key — same logical operation on the same
    // ticket always produces the same key, so retries of identical inputs are caught.
    const stableInput = JSON.stringify(
      Object.keys(input)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = input[k];
          return acc;
        }, {}),
    );
    const invocationId = createHash('sha256')
      .update(`${ctx.tenantId}:${ctx.ticketId}:${name}:${stableInput}`)
      .digest('hex')
      .slice(0, 32);

    // ADR-T5: idempotency check for mutating tools
    if (MUTATING_TOOLS.has(name)) {
      const duplicate = await _checkDuplicate(ctx.tenantId, `tool:${name}`, invocationId);
      if (duplicate) {
        logger.warn(`[ToolsHandle] Duplicate invocation suppressed — tool=${name} id=${invocationId}`);
        return { success: true, data: { idempotent: true }, errors: [] };
      }
    }

    const startMs = Date.now();
    // Tracing is LangSmith (native to @langchain/langgraph), per ADR-079 — no custom
    // OpenTelemetry spans here (N-73).
    try {
      const parsed = tool.schema.parse(input);
      const output = await tool.execute(parsed, { tenantId: ctx.tenantId, ticketId: ctx.ticketId });

      metrics.observe('tool_duration_ms', Date.now() - startMs, {
        tool_name: name,
        tenant_id: ctx.tenantId,
        success: 'true',
      });

      await _auditWriter.log({
        tenantId: ctx.tenantId,
        ticketId: ctx.ticketId,
        actor: 'ai',
        action: `tool:${name}`,
        metadata: { invocationId, input, output, success: true },
      });

      return { success: true, data: output as Record<string, unknown>, errors: [] };
    } catch (err) {
      const detail = wrapToolError(err);
      logger.error(`[ToolsHandle] Tool "${name}" failed — ${detail.code}: ${detail.message}`);

      metrics.observe('tool_duration_ms', Date.now() - startMs, {
        tool_name: name,
        tenant_id: ctx.tenantId,
        success: 'false',
      });
      metrics.increment('tool_error_total', {
        tool_name: name,
        tenant_id: ctx.tenantId,
        error_type: detail.code,
      });

      await _auditWriter.log({
        tenantId: ctx.tenantId,
        ticketId: ctx.ticketId,
        actor: 'ai',
        action: `tool:${name}:error`,
        metadata: { invocationId, input, error: detail },
      });

      return { success: false, data: null, errors: [detail] };
    }
  }
}

// Mutating tools that require idempotency protection (ADR-T5)
const MUTATING_TOOLS = new Set([
  'refund_order',
  'reset_password',
  'escalate_ticket',
  'update_delivery_address',
  'add_order_note',
  'create_order',
]);

// ── Factory ───────────────────────────────────────────────────────────────────

import { toolRegistry } from './ToolRegistry';
import { getContractFor } from './contracts';
import type { ToolDefinition as AnthropicToolDef } from '../llm/AnthropicProvider';

export function buildToolsHandle(tenantId: string, ticketId: string, allowedTools?: string[]): ToolsHandle {
  const names = allowedTools ?? toolRegistry.names();
  const entries = names
    .map((name) => {
      const tool = toolRegistry.get(name);
      if (!tool) return null;
      // humanOnly tools are never available to AI agents (ADR-068).
      // They can only be invoked via authorized human-agent API routes.
      if ((tool as any).humanOnly) {
        logger.warn(`[ToolsHandle] Blocked humanOnly tool "${name}" from AI agent context`);
        return null;
      }
      const ctx: TenantToolContext = {
        tenantId,
        ticketId,
        credentials: Object.freeze({}),
        toolConfig: Object.freeze({}),
      };
      return { tool, ctx };
    })
    .filter((e): e is ToolEntry => e !== null);

  return new ToolsHandle(entries);
}

// ── ADR-072/073: ToolManifest + resolveToolsForContext ────────────────────────

/**
 * ADR-072 — unified tool bundle. Always derived from a single source list so
 * handle and llmTools can never diverge (the pre-072 bug: contract.allowedTools
 * fed buildToolsHandle but a separately filtered list fed toAnthropicTools).
 */
export interface ToolManifest {
  /** Execution handle — call tools through this, never directly */
  handle: ToolsHandle;
  /** LLM-formatted schemas — pass directly to LLMGateway.complete({ tools }) */
  llmTools: AnthropicToolDef[];
  /** Names of the resolved tools — for logging and audit */
  toolNames: string[];
}

/**
 * ADR-073 — runtime tool scoping.
 *
 * Single entry point for all nodes that need tools. Looks up the agent contract,
 * builds the handle (which filters humanOnly tools), then derives the LLM schema
 * from the handle's actual resolved names — not the raw contract list.
 * This guarantees handle and llmTools are always in sync.
 */
export function resolveToolsForContext(agentId: string, tenantId: string, ticketId: string): ToolManifest {
  const contract = getContractFor(agentId);
  const handle = buildToolsHandle(tenantId, ticketId, contract.allowedTools);
  // Derive LLM schema from handle.toolNames — not contract.allowedTools —
  // so humanOnly filtering in buildToolsHandle is reflected in both.
  const llmTools = toolRegistry.toAnthropicTools(handle.toolNames);
  return { handle, llmTools, toolNames: handle.toolNames };
}
