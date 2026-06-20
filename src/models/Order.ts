import type { Document, Types } from 'mongoose';

export interface IOrder extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  orderId: string;
  customerEmail: string;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'pending_refund';
  total: number;
  shippingAddress?: string;
  notes?: { body: string; at: Date }[];
  trackingNumber?: string;
  refundId?: string;
  refundReason?: string;
  paidAt?: Date;
  paymentReference?: string;
  paymentGateway?: 'paystack' | 'flutterwave';
  createdAt: Date;
  updatedAt: Date;
}

export function buildOrderSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const OrderSchema = new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      orderId: { type: String, required: true, index: true },
      customerEmail: { type: String, required: true, index: true },
      status: {
        type: String,
        enum: ['pending', 'shipped', 'delivered', 'cancelled', 'refunded', 'pending_refund'],
        default: 'pending',
      },
      total: { type: Number, required: true },
      shippingAddress: { type: String },
      notes: { type: [{ body: { type: String, required: true }, at: { type: Date, default: Date.now } }], default: [] },
      trackingNumber: { type: String },
      refundId: { type: String },
      refundReason: { type: String },
      paidAt:           { type: Date },
      paymentReference: { type: String },
      paymentGateway:   { type: String, enum: ['paystack', 'flutterwave'] },
    },
    { timestamps: true },
  );
  OrderSchema.index({ tenantId: 1, orderId: 1 }, { unique: true });
  return OrderSchema;
}
