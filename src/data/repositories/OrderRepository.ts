import type { Model, FilterQuery } from 'mongoose';
import type { IOrder, OrderItem } from '../../models/Order';
import { BaseRepository } from './BaseRepository';

/** Order id generator — `ORD-<base36 time><4 random>`, unique per tenant via the index. */
export function generateOrderId(): string {
  return `ORD-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

export class OrderRepository extends BaseRepository<IOrder> {
  constructor(model: Model<IOrder>) {
    super(model, 'orders', true); // soft-delete enabled
  }

  /**
   * Capture a NEW order (CONVERSION_CAPABILITY_DESIGN). Always created `pending` (UNPAID) — this
   * never confirms payment (ADR-068: only the processor webhook → confirmPaymentByReference does).
   * Generates a unique orderId; the {tenantId, orderId} unique index is the idempotency backstop.
   */
  async createOrder(
    tenantId: string,
    data: {
      customerEmail: string;
      customerPhone?: string;
      total: number;
      items?: OrderItem[];
      shippingAddress?: string;
      orderId?: string;
    },
  ): Promise<IOrder> {
    return this.create(tenantId, {
      orderId: data.orderId ?? generateOrderId(),
      customerEmail: data.customerEmail,
      ...(data.customerPhone ? { customerPhone: data.customerPhone } : {}),
      total: data.total,
      items: data.items ?? [],
      status: 'pending',
      ...(data.shippingAddress ? { shippingAddress: data.shippingAddress } : {}),
    } as Partial<IOrder>);
  }

  async findByOrderId(tenantId: string, orderId: string): Promise<IOrder | null> {
    return this.findOne(tenantId, { orderId });
  }

  async findByCustomerEmail(tenantId: string, customerEmail: string): Promise<IOrder[]> {
    return this.find(tenantId, { customerEmail });
  }

  /**
   * Find a customer's orders by ANY trusted contact key (email and/or phone). The AI tools take the
   * customer identity from the conversation context (H2) — a WhatsApp customer is keyed by phone, an
   * email customer by email. Returns [] when no contact key is supplied (fail-closed).
   */
  async findByCustomerContact(
    tenantId: string,
    contact: { email?: string; phone?: string },
  ): Promise<IOrder[]> {
    const or: Record<string, unknown>[] = [];
    if (contact.email) or.push({ customerEmail: contact.email });
    if (contact.phone) or.push({ customerPhone: contact.phone });
    if (or.length === 0) return [];
    return this.find(tenantId, { $or: or } as FilterQuery<IOrder>);
  }

  async markPendingRefund(tenantId: string, orderId: string, reason: string): Promise<IOrder | null> {
    return this.updateById(tenantId, orderId, { $set: { status: 'pending_refund', refundReason: reason } });
  }

  async submitRefundReview(
    tenantId: string,
    orderId: string,
    reviewId: string,
    reason: string,
  ): Promise<IOrder | null> {
    return (this.model as any)
      .findOneAndUpdate(
        {
          tenantId: this.toObjectId(tenantId),
          orderId,
          deletedAt: null,
          status: { $nin: ['refunded', 'pending_refund'] },
        },
        { $set: { status: 'pending_refund', refundId: reviewId, refundReason: reason } },
        { new: true },
      )
      .lean() as Promise<IOrder | null>;
  }

  async updateShippingAddress(tenantId: string, orderId: string, address: string): Promise<IOrder | null> {
    return (this.model as any)
      .findOneAndUpdate(
        { tenantId: this.toObjectId(tenantId), orderId, deletedAt: null, status: 'pending' },
        { $set: { shippingAddress: address } },
        { new: true },
      )
      .lean() as Promise<IOrder | null>;
  }

  async addNote(tenantId: string, orderId: string, body: string): Promise<IOrder | null> {
    return (this.model as any)
      .findOneAndUpdate(
        { tenantId: this.toObjectId(tenantId), orderId, deletedAt: null },
        { $push: { notes: { body, at: new Date() } } },
        { new: true },
      )
      .lean() as Promise<IOrder | null>;
  }

  async recordRefund(tenantId: string, orderId: string, refundId: string): Promise<IOrder | null> {
    return this.updateById(tenantId, orderId, { $set: { status: 'refunded', refundId } });
  }
}
