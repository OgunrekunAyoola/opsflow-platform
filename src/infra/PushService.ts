import logger from '../shared/utils/logger';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo Push API accepts at most 100 messages per request. SB-22: batching is
 *  correctness-at-scale — a single fan-out to many recipients/devices must be
 *  split into ≤100-per-request chunks rather than one request per notification. */
const EXPO_MAX_PER_REQUEST = 100;

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/** The slice of DeviceTokenRepository that PushService needs — the host injects its
 *  registered-model singleton, so platform never reaches into the data layer directly. */
export interface DeviceTokenLookup {
  findTokensForUser(tenantId: string, userId: string): Promise<string[]>;
}

/**
 * Best-effort mobile push via the Expo Push API. This MIRRORS the in-app
 * notification (the source of truth) — so it is fail-open (failure policy class 3):
 * a push failure must never affect the notification it accompanies.
 *
 * The host injects its DeviceTokenRepository singleton in the constructor (P2/2e).
 */
export class PushService {
  constructor(private readonly deviceTokens: DeviceTokenLookup) {}

  /** Push one notification to all of a single user's devices. */
  async sendToUser(tenantId: string, userId: string, msg: PushMessage): Promise<void> {
    try {
      const tokens = await this.deviceTokens.findTokensForUser(tenantId, userId);
      await this.deliver(tokens.map((to) => this.build(to, msg)));
    } catch (err: any) {
      // fail-open: the in-app notification already landed; the push is a best-effort nudge
      logger.warn('[push] sendToUser failed', err?.message);
    }
  }

  /**
   * SB-22 — batched fan-out to many recipients in one collected delivery. Gathers
   * every recipient's device messages and posts them in ≤100-per-request chunks
   * (⌈total/100⌉ requests) instead of one request per recipient. Used by
   * NotificationRepository.createMany (e.g. notifying every admin at once).
   */
  async sendManyToUsers(
    tenantId: string,
    recipients: Array<{ userId: string; msg: PushMessage }>,
  ): Promise<void> {
    try {
      const messages: ExpoMessage[] = [];
      for (const r of recipients) {
        const tokens = await this.deviceTokens.findTokensForUser(tenantId, r.userId);
        for (const to of tokens) messages.push(this.build(to, r.msg));
      }
      await this.deliver(messages);
    } catch (err: any) {
      // fail-open: push mirrors the in-app rows, which are already persisted
      logger.warn('[push] sendManyToUsers failed', err?.message);
    }
  }

  private build(to: string, msg: PushMessage): ExpoMessage {
    return { to, sound: 'default', title: msg.title, body: msg.body, data: msg.data ?? {} };
  }

  /** POST messages to Expo in ≤100-per-request chunks. Throws on network error
   *  (callers wrap in fail-open try/catch); a non-2xx logs and continues. */
  private async deliver(messages: ExpoMessage[]): Promise<void> {
    if (!messages.length) return;
    for (let i = 0; i < messages.length; i += EXPO_MAX_PER_REQUEST) {
      const chunk = messages.slice(i, i + EXPO_MAX_PER_REQUEST);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) logger.warn(`[push] Expo push send returned ${res.status}`);
    }
  }
}
