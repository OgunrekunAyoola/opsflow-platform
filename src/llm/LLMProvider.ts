export interface LLMProvider {
  generateJSON<T = any>(
    task: string,
    prompt: string,
    meta?: { tenantId?: string; ticketId?: string }
  ): Promise<T>;

  generateText(
    task: string,
    prompt: string,
    meta?: { tenantId?: string; ticketId?: string }
  ): Promise<string>;
}

/**
 * PII masker slice the providers need — mask before egress (ADR-029). The host
 * injects its piiMasker; platform defaults to its own piiMasker singleton.
 */
export interface ProviderMasker {
  mask(text: string): Promise<{ masked: string; reversalId?: string }>;
}

/**
 * LLM call-log writer the providers fire-and-forget into (single cost writer is the
 * LLMCallCompleted subscriber, N-36 — this is the call log only). Host-injected;
 * platform defaults to a no-op so a provider works standalone.
 */
export interface CallLogger {
  log(entry: {
    tenantId?: string;
    ticketId?: string;
    task: string;
    modelName: string;
    success: boolean;
    latencyMs: number;
    error?: string;
  }): Promise<unknown>;
}

export interface ProviderDeps {
  piiMasker?: ProviderMasker;
  llmCallLog?: CallLogger;
}
