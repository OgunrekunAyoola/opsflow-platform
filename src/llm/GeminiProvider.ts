import { ModelRouter } from './ModelRouter';
import type { LLMProvider, ProviderMasker, CallLogger, ProviderDeps } from './LLMProvider';
import { piiMasker as defaultPiiMasker } from '../pii/PIIMasker';

// No dotenv.config() here — platform is a library; the host loads env at boot.

const noopCallLog: CallLogger = { log: async () => undefined };

export class GeminiProvider implements LLMProvider {
  private router: ModelRouter;
  private failureCount = 0;
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed';
  private nextAttemptAt: number | null = null;
  private readonly piiMasker: ProviderMasker;
  private readonly llmCallLog: CallLogger;

  /**
   * @param deps — host collaborators (piiMasker, llmCallLog). Defaults to platform's
   *   piiMasker + a no-op call log; the host shim injects its registered singletons.
   */
  constructor(deps: ProviderDeps = {}) {
    this.router = new ModelRouter();
    this.piiMasker = deps.piiMasker ?? defaultPiiMasker;
    this.llmCallLog = deps.llmCallLog ?? noopCallLog;
  }

  async generateJSON<T = any>(
    task: string,
    prompt: string,
    meta?: { tenantId?: string; ticketId?: string }
  ): Promise<T> {
    const { masked: maskedPrompt } = await this.piiMasker.mask(prompt);
    const model = this.router.getModel({ task: task as any, tenantId: meta?.tenantId || 'global' });

    // Circuit Breaker Check
    const now = Date.now();
    if (this.circuitState === 'open') {
      if (this.nextAttemptAt && now < this.nextAttemptAt) {
        throw new Error('LLM circuit breaker open');
      }
      this.circuitState = 'half-open';
    }

    const maxAttempts = 4;
    let attempt = 0;
    let lastError: any;
    const startedAt = Date.now();

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const msg: any = await model.invoke(maskedPrompt);
        const content = msg?.content;
        const text =
          typeof content === 'string'
            ? content
            : Array.isArray(content)
            ? content.map((c: any) => String(c?.text || '')).join('')
            : String(content ?? '');

        // Simple JSON extraction if wrapped in markdown code blocks
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : text;

        const parsed = JSON.parse(jsonStr);

        // Success - Reset Circuit
        this.failureCount = 0;
        this.circuitState = 'closed';

        const modelName: string = (model as any).modelName || 'unknown';
        const latencyMs = Date.now() - startedAt;
        const usage = msg?.response_metadata?.usageMetadata ?? msg?.usage_metadata;
        const inputTokens: number  = usage?.promptTokenCount  ?? usage?.input_tokens  ?? 0;
        const outputTokens: number = usage?.candidatesTokenCount ?? usage?.output_tokens ?? 0;

        // Fire-and-forget — never block the main path
        // Call log only. LLM cost is recorded exactly once, by the
        // LLMCallCompleted subscriber (single writer — audit N-36). Fire-and-forget.
        this.llmCallLog.log({ tenantId: meta?.tenantId, ticketId: meta?.ticketId, task, modelName, success: true, latencyMs }).catch(() => {});

        return parsed as T;
      } catch (error: any) {
        lastError = error;
        this.failureCount += 1;
        if (this.failureCount >= 5) {
          this.circuitState = 'open';
          this.nextAttemptAt = Date.now() + 5 * 60 * 1000;
        }
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
      }
    }

    await this.llmCallLog.log({
      tenantId: meta?.tenantId, ticketId: meta?.ticketId, task,
      modelName: (model as any).modelName || 'unknown',
      success: false, error: lastError?.message, latencyMs: Date.now() - startedAt,
    });

    throw lastError;
  }

  async generateText(
    task: string,
    prompt: string,
    meta?: { tenantId?: string; ticketId?: string }
  ): Promise<string> {
    return (await this.generateTextWithUsage(task, prompt, meta)).text;
  }

  /** Same as generateText but returns token usage for the LLMGateway to surface. */
  async generateTextWithUsage(
    task: string,
    prompt: string,
    meta?: { tenantId?: string; ticketId?: string }
  ): Promise<{ text: string; promptTokens: number; completionTokens: number; model: string }> {
    const { masked: maskedPrompt } = await this.piiMasker.mask(prompt);
    const model = this.router.getModel({ task: task as any, tenantId: meta?.tenantId || 'global' });

    const startedAt = Date.now();
    try {
        const msg: any = await model.invoke(maskedPrompt);
        const content = msg?.content;
        const text =
          typeof content === 'string'
            ? content
            : Array.isArray(content)
            ? content.map((c: any) => String(c?.text || '')).join('')
            : String(content ?? '');

        const modelName: string = (model as any).modelName || 'unknown';
        const latencyMs = Date.now() - startedAt;
        const usage = msg?.response_metadata?.usageMetadata ?? msg?.usage_metadata;
        const inputTokens: number  = usage?.promptTokenCount  ?? usage?.input_tokens  ?? 0;
        const outputTokens: number = usage?.candidatesTokenCount ?? usage?.output_tokens ?? 0;

        // Call log only. LLM cost is recorded exactly once, by the
        // LLMCallCompleted subscriber (single writer — audit N-36). Fire-and-forget.
        this.llmCallLog.log({ tenantId: meta?.tenantId, ticketId: meta?.ticketId, task, modelName, success: true, latencyMs }).catch(() => {});

        return { text, promptTokens: inputTokens, completionTokens: outputTokens, model: modelName };
    } catch (error: any) {
        this.llmCallLog.log({
          tenantId: meta?.tenantId, ticketId: meta?.ticketId, task,
          modelName: (model as any).modelName || 'unknown',
          success: false, error: error.message, latencyMs: Date.now() - startedAt,
        }).catch(() => {});
        throw error;
    }
  }
}
