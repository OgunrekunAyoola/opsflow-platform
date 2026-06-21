import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ProviderMasker, CallLogger, ProviderDeps } from './LLMProvider';
import { piiMasker as defaultPiiMasker } from '../pii/PIIMasker';
import logger from '../shared/utils/logger';

type Meta = { tenantId?: string; ticketId?: string };

const noopCallLog: CallLogger = { log: async () => undefined };

/**
 * The slice of the Anthropic SDK the provider uses. Injectable so tests can pass a
 * fake client (under file: linking the platform carries its own @anthropic-ai/sdk
 * copy, so a jest module mock of the SDK in the host can't reach it — N-74 class).
 */
export interface AnthropicLike {
  messages: { create(body: any): Promise<Anthropic.Message> };
}

export interface AnthropicProviderDeps extends ProviderDeps {
  client?: AnthropicLike;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Anthropic.Tool['input_schema'];
}

export interface ToolUseResult {
  text: string;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  rawContent: Anthropic.ContentBlock[];  // needed by callers building multi-turn history
  stopReason: string;
  promptTokens: number;
  completionTokens: number;
}

// Raw token usage returned to LLMGateway so it can surface metrics/cost.
// Providers report token counts only; cost attribution is the gateway's job.
export interface TextWithUsage {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

export class AnthropicProvider implements LLMProvider {
  private client: AnthropicLike;
  private model: string;
  private readonly piiMasker: ProviderMasker;
  private readonly llmCallLog: CallLogger;

  /**
   * @param apiKey — optional override; defaults to process.env.ANTHROPIC_API_KEY.
   *   LLMGateway passes a per-agent resolved key (Block 5 Step 3) so agents can
   *   have independent API keys without touching the shared env var.
   * @param deps — host collaborators (piiMasker, llmCallLog) + an optional client
   *   override for tests. Defaults to platform's piiMasker + a no-op call log + a
   *   real Anthropic client; the host shim injects its registered singletons.
   */
  constructor(apiKey?: string, deps: AnthropicProviderDeps = {}) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key && !deps.client) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    this.client = deps.client ?? new Anthropic({ apiKey: key! });
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    this.piiMasker = deps.piiMasker ?? defaultPiiMasker;
    this.llmCallLog = deps.llmCallLog ?? noopCallLog;
  }

  async generateJSON<T = any>(task: string, prompt: string, meta?: Meta): Promise<T> {
    const { masked } = await this.piiMasker.mask(prompt);
    const startedAt = Date.now();

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: masked }],
      });

      const text = this._extractText(response);
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : text);

      await this._log(task, true, Date.now() - startedAt, response.usage, meta);
      return parsed as T;
    } catch (err: any) {
      await this._log(task, false, Date.now() - startedAt, undefined, meta, err.message);
      throw err;
    }
  }

  async generateText(task: string, prompt: string, meta?: Meta): Promise<string> {
    return (await this.generateTextWithUsage(task, prompt, meta)).text;
  }

  /** Same as generateText but returns token usage for the LLMGateway to surface. */
  async generateTextWithUsage(task: string, prompt: string, meta?: Meta): Promise<TextWithUsage> {
    const { masked } = await this.piiMasker.mask(prompt);
    const startedAt = Date.now();

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: masked }],
      });

      const text = this._extractText(response);
      await this._log(task, true, Date.now() - startedAt, response.usage, meta);
      return {
        text,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      };
    } catch (err: any) {
      await this._log(task, false, Date.now() - startedAt, undefined, meta, err.message);
      throw err;
    }
  }

  /**
   * Multi-turn tool-use call. Accepts a full Anthropic messages[] array so the
   * caller can extend the conversation history across iterations and feed tool
   * results back to the model. Returns rawContent so callers can append the
   * assistant turn to their history without re-parsing.
   */
  async generateWithTools(
    task: string,
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
    tools: ToolDefinition[],
    meta?: Meta,
  ): Promise<ToolUseResult> {
    // PII masking before egress (ADR-029) — EVERY LLM call path must mask, the
    // tool loop included (audit N-63). Mask the system prompt and the text content
    // of every message (incl. tool_result text); tool_use structured args pass
    // through. Consistent with the other provider paths, the reversal is discarded
    // (the model works in masked space). Tools keyed on non-PII identifiers (order
    // IDs) are unaffected; PII-keyed tool args are tracked separately (N-66).
    const maskedSystem = (await this.piiMasker.mask(systemPrompt)).masked;
    const maskedMessages = await this._maskMessages(messages);
    const startedAt = Date.now();

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: maskedSystem,
        tools: tools as Anthropic.Tool[],
        messages: maskedMessages,
      });

      const text = this._extractText(response);
      const toolCalls = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));

      await this._log(task, true, Date.now() - startedAt, response.usage, meta);
      return {
        text,
        toolCalls,
        rawContent: response.content,
        stopReason: response.stop_reason ?? 'end_turn',
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      };
    } catch (err: any) {
      await this._log(task, false, Date.now() - startedAt, undefined, meta, err.message);
      throw err;
    }
  }

  private _extractText(response: Anthropic.Message): string {
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }

  /**
   * Mask the text content of an Anthropic messages[] array before egress (ADR-029).
   * Masks string content, `text` blocks, and `tool_result` text; passes `tool_use`
   * structured args through unchanged (they hold IDs/queries derived from already-
   * masked context, not raw PII). Used by the tool-loop path (audit N-63).
   */
  private async _maskMessages(messages: Anthropic.MessageParam[]): Promise<Anthropic.MessageParam[]> {
    return Promise.all(
      messages.map(async (m) => {
        if (typeof m.content === 'string') {
          return { ...m, content: (await this.piiMasker.mask(m.content)).masked };
        }
        const blocks = await Promise.all(
          (m.content as Anthropic.ContentBlockParam[]).map(async (block) => {
            if (block.type === 'text') {
              return { ...block, text: (await this.piiMasker.mask(block.text)).masked };
            }
            if (block.type === 'tool_result') {
              const c = block.content;
              if (typeof c === 'string') {
                return { ...block, content: (await this.piiMasker.mask(c)).masked };
              }
              if (Array.isArray(c)) {
                const inner = await Promise.all(
                  c.map(async (b) =>
                    b.type === 'text' ? { ...b, text: (await this.piiMasker.mask(b.text)).masked } : b,
                  ),
                );
                return { ...block, content: inner };
              }
            }
            return block;
          }),
        );
        return { ...m, content: blocks } as Anthropic.MessageParam;
      }),
    );
  }

  private async _log(
    task: string,
    success: boolean,
    latencyMs: number,
    usage?: Anthropic.Usage,
    meta?: Meta,
    error?: string,
  ): Promise<void> {
    // Call log only — fire-and-forget. LLM cost is recorded exactly once, by the
    // LLMCallCompleted subscriber (single writer — audit N-36). `usage` is no
    // longer consumed here but is kept on the signature for the call-log shape.
    void usage;
    this.llmCallLog.log({
      tenantId: meta?.tenantId,
      ticketId: meta?.ticketId,
      task,
      modelName: this.model,
      success,
      latencyMs,
      error,
    }).catch((e) => logger.warn('[AnthropicProvider] Failed to write LlmCallLog', e));
  }
}
