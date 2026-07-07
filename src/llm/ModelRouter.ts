import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { routeForTask, type LLMProviderName } from './routing';
import type { LLMTask } from './LLMGateway';

// No dotenv.config() here — platform is a library; the host loads env at boot
// (monolith index.ts: `import 'dotenv/config'`). Reads process.env at call time.

interface RouterOptions {
  task: LLMTask;
  tenantId: string;
}

/**
 * Serves the Gemini chat model for a task. Since S-07 this is a thin view over `routing.ts`
 * (the ONE ADR-027 table) — it holds no routing opinion of its own, so it can no longer
 * disagree with the gateway about a task's provider/model.
 */
export class ModelRouter {
  getProvider(task: LLMTask): LLMProviderName {
    return routeForTask(task).provider;
  }

  getModel({ task }: RouterOptions) {
    const route = routeForTask(task);
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    // Always the route's GEMINI model: this method exists only for the Gemini call path
    // (primary for flash-class tasks; failover-remapped tasks arrive already remapped).
    return new ChatGoogleGenerativeAI({
      model: route.model.gemini,
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.2,
    });
  }
}
