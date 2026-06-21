import logger from '../shared/utils/logger';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
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

  async sendToUser(tenantId: string, userId: string, msg: PushMessage): Promise<void> {
    try {
      const tokens = await this.deviceTokens.findTokensForUser(tenantId, userId);
      if (!tokens.length) return;
      const messages = tokens.map((to) => ({
        to,
        sound: 'default',
        title: msg.title,
        body: msg.body,
        data: msg.data ?? {},
      }));
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
      if (!res.ok) logger.warn(`[push] Expo push send returned ${res.status}`);
    } catch (err: any) {
      // fail-open: the in-app notification already landed; the push is a best-effort nudge
      logger.warn('[push] sendToUser failed', err?.message);
    }
  }
}
