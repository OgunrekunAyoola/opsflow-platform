import type { z } from 'zod';

/**
 * Platform-level tool contract (ADR-T1).
 *
 * Tool *definitions* (instances of this interface) live in
 * `domains/{industry}/tools/` in the host — never here. This file only owns the shape.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType<Record<string, unknown>>;
  // humanOnly: true means this tool can NEVER be called by AI agents.
  // It may only be invoked via admin/agent API routes with human authorization.
  humanOnly?: boolean;
  execute: (
    args: Record<string, unknown> | unknown,
    context: { tenantId: string; userId?: string; ticketId?: string },
  ) => Promise<Record<string, unknown>>;
}
