import type { Model } from 'mongoose';
import type { IOrder } from '../../models/Order';
import { BaseRepository } from './BaseRepository';

export class OrderRepository extends BaseRepository<IOrder> {
  constructor(model: Model<IOrder>) {
    super(model, 'orders', true); // soft-delete enabled
  }

  async findByOrderId(tenantId: string, orderId: string): Promise<IOrder | null> {
    return this.findOne(tenantId, { orderId });
  }

  async findByCustomerEmail(tenantId: string, customerEmail: string): Promise<IOrder[]> {
    return this.find(tenantId, { customerEmail });
  }

  async markPendingRefund(tenantId: string, orderId: string, reason: string): Promise<IOrder | null> {
    return this.updateById(tenantId, orderId, { $set: { status: 'pending_refund', refundReason: reason } });
  }

  async submitRefundReview(tenantId: string, orderId: string, reviewId: string, reason: string): Promise<IOrder | null> {
    return (this.model as any).findOneAndUpdate(
      { tenantId: this.toObjectId(tenantId), orderId, deletedAt: null, status: { $nin: ['refunded', 'pending_refund'] } },
      { $set: { status: 'pending_refund', refundId: reviewId, refundReason: reason } },
      { new: true },
    ).lean() as Promise<IOrder | null>;
  }

  async confirmPaymentByReference(
    tenantId: string,
    reference: string,
    gateway: 'paystack' | 'flutterwave',
  ): Promise<IOrder | null> {
    return (this.model as any).findOneAndUpdate(
      { tenantId: this.toObjectId(tenantId), orderId: reference, deletedAt: null },
      { $set: { paidAt: new Date(), paymentReference: reference, paymentGateway: gateway } },
      { new: true },
    ).lean() as Promise<IOrder | null>;
  }

  async updateShippingAddress(tenantId: string, orderId: string, address: string): Promise<IOrder | null> {
    return (this.model as any).findOneAndUpdate(
      { tenantId: this.toObjectId(tenantId), orderId, deletedAt: null, status: 'pending' },
      { $set: { shippingAddress: address } },
      { new: true },
    ).lean() as Promise<IOrder | null>;
  }

  async addNote(tenantId: string, orderId: string, body: string): Promise<IOrder | null> {
    return (this.model as any).findOneAndUpdate(
      { tenantId: this.toObjectId(tenantId), orderId, deletedAt: null },
      { $push: { notes: { body, at: new Date() } } },
      { new: true },
    ).lean() as Promise<IOrder | null>;
  }

  async recordRefund(tenantId: string, orderId: string, refundId: string): Promise<IOrder | null> {
    return this.updateById(tenantId, orderId, { $set: { status: 'refunded', refundId } });
  }
}
