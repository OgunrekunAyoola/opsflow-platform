import type { ToolDefinition } from './ToolDefinition';
import type { ToolDefinition as AnthropicToolDef } from '../llm/AnthropicProvider';
import logger from '../shared/utils/logger';

type ToolContext = { tenantId: string; userId?: string; ticketId?: string };

// ── Zod v4 → JSON Schema ──────────────────────────────────────────────────────
// Uses runtime `_def`/`def` introspection so no instanceof version mismatch.

function getZodDef(schema: any): Record<string, any> {
  return schema._def ?? schema.def ?? {};
}

function zodToJsonSchema(schema: any): Record<string, unknown> {
  const def = getZodDef(schema);
  if (def.type === 'object') {
    const shape: Record<string, any> = def.shape ?? {};
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, field] of Object.entries(shape)) {
      properties[key] = zodFieldToJsonSchema(field);
      const fieldDef = getZodDef(field);
      if (fieldDef.type !== 'optional' && fieldDef.type !== 'default') {
        required.push(key);
      }
    }

    return { type: 'object', properties, required };
  }
  return { type: 'object', properties: {} };
}

function zodFieldToJsonSchema(field: any): Record<string, unknown> {
  const def = getZodDef(field);

  if (def.type === 'optional') return zodFieldToJsonSchema(def.innerType);
  if (def.type === 'default') return zodFieldToJsonSchema(def.innerType);

  const base: Record<string, unknown> = {};
  if (typeof field.description === 'string') base.description = field.description;

  switch (def.type) {
    case 'string':
      return { type: 'string', ...base };
    case 'number':
      return { type: 'number', ...base };
    case 'boolean':
      return { type: 'boolean', ...base };
    case 'enum':
      return { type: 'string', enum: def.entries ? Object.keys(def.entries) : (def.values ?? []), ...base };
    case 'array':
      return { type: 'array', items: zodFieldToJsonSchema(def.element), ...base };
    default:
      return base;
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────
// Domain-agnostic: the host registers its `domains/{industry}/tools/` into this
// registry at boot via register() — platform never imports domain tools (P2/2g).

class ToolRegistry {
  private registry = new Map<string, ToolDefinition>();

  register(def: ToolDefinition): void {
    this.registry.set(def.name, def);
  }

  get(name: string): ToolDefinition | undefined {
    return this.registry.get(name);
  }

  names(): string[] {
    return [...this.registry.keys()];
  }

  /** Returns all (or a named subset of) tools in Anthropic tool_use format. */
  toAnthropicTools(names?: string[]): AnthropicToolDef[] {
    const entries = names
      ? names.map((n) => this.registry.get(n)).filter((d): d is ToolDefinition => Boolean(d))
      : [...this.registry.values()];

    return entries.map((def) => ({
      name: def.name,
      description: def.description,
      input_schema: zodToJsonSchema(def.schema) as AnthropicToolDef['input_schema'],
    }));
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<Record<string, unknown>> {
    const def = this.registry.get(name);
    if (!def) {
      logger.warn(`[ToolRegistry] Unknown tool: ${name}`);
      return { success: false, error: `Tool "${name}" not found` };
    }

    try {
      const parsed = def.schema.parse(args);
      return await def.execute(parsed, context);
    } catch (err: any) {
      logger.error(`[ToolRegistry] Tool "${name}" failed`, err);
      return { success: false, error: err.message ?? 'Tool execution failed' };
    }
  }
}

export const toolRegistry = new ToolRegistry();
export type { ToolDefinition, ToolContext };
