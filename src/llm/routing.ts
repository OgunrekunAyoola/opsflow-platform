/**
 * ADR-027 task routing — THE single source of truth (S-07).
 *
 * Before this module, provider choice lived in LLMGateway.TASK_PROVIDER while model choice lived in
 * ModelRouter.getConfig — and the two DISAGREED (the router said answer_generation → gemini-2.5-pro,
 * the gateway routed it to Anthropic; only the gateway's vote counted at runtime). Both now delegate
 * here; a task's route can no longer drift between the two.
 *
 * Reads env at CALL time (platform is a library — the host loads env at boot).
 */
import type { LLMTask } from './LLMGateway';

export type LLMProviderName = 'anthropic' | 'gemini';

export interface TaskRoute {
  /** ADR-027 primary provider for the task. */
  provider: LLMProviderName;
  /** Model per provider — failover serves the task on the OTHER provider's model. */
  model: Record<LLMProviderName, string>;
}

export function routeForTask(task: LLMTask): TaskRoute {
  const geminiFlash = process.env.MODEL_CLASSIFICATION || 'gemini-2.5-flash';
  const geminiPro = process.env.MODEL_ANSWER || 'gemini-2.5-pro';
  const geminiSelfEval = process.env.MODEL_SELF_EVAL || geminiFlash;
  const anthropic = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

  switch (task) {
    case 'classification':
    case 'summary':
      return { provider: 'gemini', model: { gemini: geminiFlash, anthropic } };
    case 'self_eval':
      return { provider: 'gemini', model: { gemini: geminiSelfEval, anthropic } };
    // Anthropic-native tasks; on failover Gemini serves them (remapped) on the pro model.
    case 'answer_generation':
    case 'memory_extraction':
    case 'tool_use':
      return { provider: 'anthropic', model: { anthropic, gemini: geminiPro } };
    default:
      return { provider: 'gemini', model: { gemini: geminiPro, anthropic } };
  }
}
