import type { DomainEvent, DomainEventName, EventHandler, IEventBus, SubscriberOptions } from './DomainEvent';
import logger from '../shared/utils/logger';

// ── Host collaborators (injected) ─────────────────────────────────────────────
// The bus persists to the host's DomainEventLog model, enqueues onto the host's
// BullMQ queue, and reads/writes the host's Redis — platform never reaches into
// the host's models/queue/connection directly (P2/2f). The queue is resolved
// lazily so the host's queue/index.ts is not pulled in before env is ready.

export interface EventLogStore {
  create(doc: Record<string, unknown>): Promise<unknown>;
}
export interface EventQueue {
  add(name: string, data: unknown, opts?: unknown): Promise<unknown>;
}
export interface EventRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, ttlSeconds: number): Promise<unknown>;
}
export interface EventBusDeps {
  eventLog: EventLogStore;
  queueProvider: () => EventQueue;
  getRedis: () => EventRedis | null;
}

interface SubscriberEntry {
  handler: EventHandler<any>;
  subscriberName: string;
}

// ── EventBus implementation ───────────────────────────────────────────────────

export class BullMQEventBus implements IEventBus {
  private readonly subscribers = new Map<DomainEventName, SubscriberEntry[]>();
  private _queue?: EventQueue;

  constructor(private readonly deps: EventBusDeps) {}

  private getQueue(): EventQueue {
    if (!this._queue) this._queue = this.deps.queueProvider();
    return this._queue;
  }

  // ── Emit ──────────────────────────────────────────────────────────────────

  async emit<T>(event: DomainEvent<T>): Promise<void> {
    // 1. Persist to MongoDB (durable event log)
    try {
      await this.deps.eventLog.create({
        eventId: event.eventId,
        eventName: event.eventName,
        tenantId: event.tenantId,
        partitionKey: event.partitionKey,
        occurredAt: event.occurredAt,
        correlationId: event.correlationId,
        payload: event.payload,
        enqueuedAt: new Date(),
      });
    } catch (err: any) {
      // Duplicate eventId (replay) is OK — skip silently
      if (err?.code !== 11000) {
        logger.warn(
          { event: 'event_log_write_failed', eventName: event.eventName, err: err.message },
          'DomainEventLog write failed — event still enqueued',
        );
      }
    }

    // 2. Enqueue to BullMQ for async dispatch to subscribers
    try {
      await this.getQueue().add(event.eventName, event, {
        jobId: event.eventId, // dedup at BullMQ level
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      });
    } catch (err: any) {
      logger.warn(
        { event: 'event_enqueue_failed', eventName: event.eventName, err: err.message },
        'DomainEvent enqueue failed',
      );
    }

    logger.info(
      {
        event: 'domain_event_emitted',
        eventName: event.eventName,
        tenantId: event.tenantId,
        eventId: event.eventId,
      },
      'Domain event emitted',
    );
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────

  subscribe<T>(eventName: DomainEventName, handler: EventHandler<T>, options: SubscriberOptions): void {
    const entries = this.subscribers.get(eventName) ?? [];
    entries.push({ handler: handler as EventHandler<any>, subscriberName: options.subscriberName });
    this.subscribers.set(eventName, entries);
    logger.info(
      { event: 'subscriber_registered', eventName, subscriberName: options.subscriberName },
      'Subscriber registered',
    );
  }

  // ── Dispatch (called by BullMQ worker) ───────────────────────────────────

  async dispatch<T>(event: DomainEvent<T>): Promise<void> {
    const entries = this.subscribers.get(event.eventName) ?? [];
    if (entries.length === 0) return;

    const redis = this.deps.getRedis();

    const results = await Promise.allSettled(
      entries.map(async ({ handler, subscriberName }) => {
        const markerKey = `processed_events:${subscriberName}:${event.eventId}`;

        // Idempotency check — skip if already processed
        if (redis) {
          const done = await redis.get(markerKey).catch(() => null);
          if (done) {
            logger.info(
              { event: 'subscriber_skipped_idempotent', subscriberName, eventId: event.eventId },
              'Event already processed by subscriber',
            );
            return;
          }
        }

        try {
          await handler(event);

          // Mark as processed (7-day TTL — well beyond event retention)
          if (redis) {
            await redis.set(markerKey, '1', 'EX', 7 * 24 * 3600).catch(() => {});
          }

          logger.info(
            {
              event: 'subscriber_success',
              subscriberName,
              eventName: event.eventName,
              eventId: event.eventId,
            },
            'Subscriber processed event',
          );
        } catch (err: any) {
          logger.error(
            {
              event: 'subscriber_error',
              subscriberName,
              eventName: event.eventName,
              eventId: event.eventId,
              err: err.message,
            },
            'Subscriber failed — will be retried by BullMQ',
          );
          throw err;
        }
      }),
    );

    // Re-throw first subscriber failure so the BullMQ job is marked failed and retried.
    // Promise.allSettled otherwise swallows all rejections and the worker sees success.
    const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (firstFailure) throw firstFailure.reason;
  }
}
