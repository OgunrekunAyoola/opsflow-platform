import type { Document, Types } from 'mongoose';

export type DevicePlatform = 'ios' | 'android';

/** A registered mobile device's Expo push token (one per device, re-pointed to the
 *  current user on login). Tenant-scoped per ADR-002. */
export interface IDeviceToken extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  token: string; // ExponentPushToken[...]
  platform: DevicePlatform;
  createdAt: Date;
  updatedAt: Date;
}

export function buildDeviceTokenSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  return new Schema<IDeviceToken>(
    {
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      token: { type: String, required: true, unique: true },
      platform: { type: String, enum: ['ios', 'android'], required: true },
    },
    { timestamps: true },
  );
}
