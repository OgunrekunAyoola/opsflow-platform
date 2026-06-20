import type { Document, Types } from 'mongoose';
import { ROLES } from '@opsflow/contracts';

// Model schemas live in @opsflow/platform but are REGISTERED by the host app on its
// own mongoose instance (the factory pattern — REPO_TOPOLOGY / P2/2b). Platform never
// calls mongoose.model() and never requires mongoose at runtime (type-only imports +
// the host-passed `m`), so there is exactly one mongoose instance + connection.

export interface IUser extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'support_agent';
  isEmailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  skills?: string[];
  maxConcurrentTickets?: number;
  createdAt: Date;
  updatedAt: Date;
}

export function buildUserSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  const UserSchema = new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
      name: { type: String, required: true },
      email: { type: String, required: true },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: [...ROLES], default: 'support_agent' },
      isEmailVerified: { type: Boolean, default: false },
      verificationToken: { type: String },
      verificationTokenExpires: { type: Date },
      resetPasswordToken: { type: String },
      resetPasswordExpires: { type: Date },
      skills: { type: [String], default: [] },
      maxConcurrentTickets: { type: Number, default: 10 },
    },
    { timestamps: true },
  );

  UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

  return UserSchema;
}
