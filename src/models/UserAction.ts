import type { Document, Types } from 'mongoose';

export interface IUserAction extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  type: string;
  subjectId?: Types.ObjectId;
  meta?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export function buildUserActionSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const UserActionSchema = new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      type: { type: String, required: true },
      subjectId: { type: Schema.Types.ObjectId },
      meta: { type: Object },
    },
    { timestamps: true },
  );
  UserActionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
  return UserActionSchema;
}
