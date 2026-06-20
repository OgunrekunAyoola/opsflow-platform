import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

interface CorrelationStore {
  correlationId: string;
  tenantId?: string;
  ticketId?: string;
  /**
   * The orchestrator agent/node currently executing (set by withNodeMetrics). Lets
   * any I/O performed during a node be attributed to the agent that triggered it —
   * for agent-tagged logs/audit, and as the identity a future per-agent repository
   * access guard checks against capabilities.yaml (governance — N-68).
   */
  agentId?: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationStore>();

export function getCorrelation(): Partial<CorrelationStore> {
  return correlationStorage.getStore() ?? {};
}

export function runWithCorrelation<T>(store: CorrelationStore, fn: () => T): T {
  return correlationStorage.run(store, fn);
}

/**
 * Runs `fn` with the current agent set in the correlation context, preserving any
 * existing correlation fields (correlationId/tenantId/ticketId). Used to wrap each
 * graph node's execution so downstream I/O is attributed to the agent.
 */
export function runWithAgent<T>(agentId: string, fn: () => T): T {
  const current = correlationStorage.getStore();
  // Preserve an existing correlationId; otherwise mint a real one. Never inject an
  // empty string — downstream consumers (e.g. makeDomainEvent → DomainEventLog, which
  // requires correlationId) treat '' as missing and reject the write.
  const next: CorrelationStore = current
    ? { ...current, agentId }
    : { correlationId: randomUUID(), agentId };
  return correlationStorage.run(next, fn);
}

/** The agent currently executing, if any (undefined outside a graph node). */
export function getCurrentAgent(): string | undefined {
  return correlationStorage.getStore()?.agentId;
}
