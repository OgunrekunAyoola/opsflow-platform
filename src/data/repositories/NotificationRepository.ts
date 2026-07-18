import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import type { INotification } from '../../models/Notification';
import { BaseRepository } from './BaseRepository';
import type { PushMessage } from '../../infra/PushService';

/** The slice of PushService that NotificationRepository needs — the host injects its
 *  pushService singleton so the repo can mirror in-app notifications to mobile push.
 *  `sendManyToUsers` is the SB-22 batched fan-out (createMany → one chunked delivery). */
export interface PushNotifier {
  sendToUser(tenantId: string, userId: string, msg: PushMessage): Promise<void>;
  sendManyToUsers(tenantId: string, recipients: Array<{ userId: string; msg: PushMessage }>): Promise<void>;
}

export class NotificationRepository extends BaseRepository<INotification> {
  constructor(
    model: Model<INotification>,
    private readonly push: PushNotifier,
  ) {
    super(model, 'notifications', true); // soft-delete enabled
  }

  /** Override create to mirror the in-app notification as a best-effort mobile push. */
  async create(tenantId: string, data: Partial<INotification>): Promise<INotification> {
    const notif = await super.create(tenantId, data);
    this.fanOutPush(tenantId, data);
    return notif;
  }

  /** fail-open (class 3): the in-app notification is the source of truth; push is a nudge. */
  private fanOutPush(tenantId: string, item: Partial<INotification>): void {
    const recipient = this.toRecipient(item);
    if (!recipient) return;
    void this.push.sendToUser(tenantId, recipient.userId, recipient.msg);
  }

  /** Map a notification row to a push recipient, or null if it can't be delivered. */
  private toRecipient(item: Partial<INotification>): { userId: string; msg: PushMessage } | null {
    const userId = (item as any).userId?.toString?.();
    if (!userId || !item.message) return null;
    return {
      userId,
      msg: {
        title: 'OpsFlow',
        body: item.message,
        data: { url: (item as any).url, type: (item as any).type },
      },
    };
  }

  /**
   * Bulk-create notifications in a single round-trip.
   * Equivalent to Notification.insertMany() with tenantId injected.
   */
  async createMany(tenantId: string, items: Array<Omit<Partial<INotification>, 'tenantId'>>): Promise<void> {
    if (!items.length) return;
    const tid = new mongoose.Types.ObjectId(tenantId);
    await (this.model as any).insertMany(items.map((item) => ({ ...item, tenantId: tid })));
    // SB-22: one batched push (chunked ≤100/request) across all recipients instead
    // of one Expo request per row. The notifier still fires a per-user realtime
    // nudge inside sendManyToUsers so every recipient's web bell updates instantly.
    const recipients = items
      .map((item) => this.toRecipient(item as Partial<INotification>))
      .filter((r): r is { userId: string; msg: PushMessage } => r !== null);
    if (recipients.length) void this.push.sendManyToUsers(tenantId, recipients);
  }

  /** Fetch recent notifications for a user, newest first. */
  async findForUser(tenantId: string, userId: string, limit = 10): Promise<INotification[]> {
    return (this.model as any)
      .find({
        tenantId: this.toObjectId(tenantId),
        userId: new mongoose.Types.ObjectId(userId),
        deletedAt: null,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean() as Promise<INotification[]>;
  }

  /** Count unread notifications for a user. */
  async countUnread(tenantId: string, userId: string): Promise<number> {
    return (this.model as any).countDocuments({
      tenantId: this.toObjectId(tenantId),
      userId: new mongoose.Types.ObjectId(userId),
      deletedAt: null,
      readAt: { $exists: false },
    });
  }

  /** Mark all unread notifications as read for a user. */
  async markAllRead(tenantId: string, userId: string): Promise<void> {
    await (this.model as any).updateMany(
      {
        tenantId: this.toObjectId(tenantId),
        userId: new mongoose.Types.ObjectId(userId),
        readAt: { $exists: false },
      },
      { $set: { readAt: new Date() } },
    );
  }

  /** Mark a single notification as read (scoped to tenant + user for safety). */
  async markOneRead(tenantId: string, notificationId: string, userId: string): Promise<INotification | null> {
    return (this.model as any).findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(notificationId),
        tenantId: this.toObjectId(tenantId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: { readAt: new Date() } },
      { new: true, lean: true },
    ) as Promise<INotification | null>;
  }
}
