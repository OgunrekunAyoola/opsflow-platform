import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// No dotenv.config() here — platform is a library; the host loads env at boot
// (monolith index.ts: `import 'dotenv/config'`). Reads process.env at call time.

type TaskType = 'classification' | 'answer_generation' | 'self_eval' | 'tool_use' | 'summary' | 'memory_extraction';

interface ModelConfig {
  id: string;
  provider: 'gemini' | 'openai' | 'anthropic';
  model: string;
}

interface RouterOptions {
  task: TaskType;
  tenantId: string;
}

export class ModelRouter {
  private getConfig(task: TaskType): ModelConfig {
    // gemini-1.5-* was fully retired from the API (404). 2.5 is the current line.
    const classification = process.env.MODEL_CLASSIFICATION || 'gemini-2.5-flash';
    const answer = process.env.MODEL_ANSWER || 'gemini-2.5-pro';
    const selfEval = process.env.MODEL_SELF_EVAL || classification;
    const toolUse = process.env.MODEL_TOOL_USE || 'claude-sonnet-4-6';

    if (task === 'classification' || task === 'summary') {
      return { id: 'classification', provider: 'gemini', model: classification };
    }
    if (task === 'self_eval') {
      return { id: 'self_eval', provider: 'gemini', model: selfEval };
    }
    if (task === 'tool_use') {
      return { id: 'tool_use', provider: 'anthropic', model: toolUse };
    }
    return { id: 'answer', provider: 'gemini', model: answer };
  }

  getProvider(task: TaskType): 'gemini' | 'anthropic' {
    return this.getConfig(task).provider as 'gemini' | 'anthropic';
  }

  getModel({ task }: RouterOptions) {
    const cfg = this.getConfig(task);
    if (cfg.provider === 'gemini') {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
      }
      return new ChatGoogleGenerativeAI({
        model: cfg.model,
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0.2,
      });
    }

    throw new Error(`ModelRouter.getModel() does not serve provider "${cfg.provider}" — use AnthropicProvider directly`);
  }
}
