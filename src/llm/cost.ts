// Approximate token costs (USD per 1M tokens) — updated per provider pricing.
// gemini-2.5 replaces the retired 1.5 line; 1.5 rows kept for historical ledger
// rows that already recorded that modelName.
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
};

/**
 * Single source of truth for LLM cost. Used by both the ledger (record) and the
 * LLMGateway (to surface totalCostUsd in metrics/events). Unknown models fall back
 * to a conservative default so cost is never silently zero.
 */
export function computeLlmCostUsd(modelName: string, inputTokens: number, outputTokens: number): number {
  const pricing = COST_PER_1M[modelName] ?? { input: 1.0, output: 5.0 };
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
