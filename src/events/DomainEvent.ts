import { randomUUID } from 'crypto';
import type { DomainEvent, DomainEventName, EventHandler, SubscriberOptions } from '@opsflow/contracts';

// ── Event names, envelope, subscriber descriptor (ADR-076) ────────────────────
// These live in the published @opsflow/contracts (strangler P1). Re-exported here
// so importers get them from the platform too. The IEventBus interface +
// makeDomainEvent factory below are the runtime contract the EventBus implements.
export type { DomainEvent, DomainEventName, EventHandler, SubscriberOptions } from '@opsflow/contracts';

// ── EventBus interface ────────────────────────────────────────────────────────

export interface IEventBus {
  emit<T>(event: DomainEvent<T>): Promise<void>;
  subscribe<T>(
    eventName: DomainEventName,
    handler: EventHandler<T>,
    options: SubscriberOptions,
  ): void;
  /** Dispatch an event to all registered subscribers (called by BullMQ worker). */
  dispatch<T>(event: DomainEvent<T>): Promise<void>;
}

// ── Factory helper ────────────────────────────────────────────────────────────

export function makeDomainEvent<T>(
  eventName: DomainEventName,
  tenantId: string,
  partitionKey: string,
  payload: T,
  correlationId?: string,
): DomainEvent<T> {
  return {
    eventId:      randomUUID(),
    eventName,
    tenantId,
    partitionKey,
    occurredAt:   new Date(),
    correlationId: correlationId ?? randomUUID(),
    payload,
  };
}
