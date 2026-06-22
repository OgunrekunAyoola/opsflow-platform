import type { Document, Types } from 'mongoose';

export interface IWorkflowRunStep {
  agentName: string;
  startedAt: Date;
  completedAt?: Date;
  success: boolean;
  error?: string;
  tokensUsed?: number;
}

export interface IWorkflowRun extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  type: 'ticket_triage';
  ticketId: Types.ObjectId;
  status: 'running' | 'succeeded' | 'failed';
  startedByUserId?: Types.ObjectId;
  startedAt: Date;
  finishedAt?: Date;
  errorMessage?: string;
  /** G3: the immutable config snapshot this run executed with (reproducibility/audit). */
  configSnapshotId?: Types.ObjectId;
  configVersion?: number;
  steps: IWorkflowRunStep[];
}

export function buildWorkflowRunSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  return new Schema({
    deletedAt: { type: Date, default: null },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    type: { type: String, enum: ['ticket_triage', 'agent_orchestration'], required: true },
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    status: { type: String, enum: ['running', 'succeeded', 'failed'], default: 'running' },
    startedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    errorMessage: { type: String },
    configSnapshotId: { type: Schema.Types.ObjectId, ref: 'ConfigSnapshot' },
    configVersion: { type: Number },
    steps: [
      {
        agentName: { type: String, required: true },
        startedAt: { type: Date, required: true },
        completedAt: { type: Date },
        success: { type: Boolean, required: true },
        error: { type: String },
        tokensUsed: { type: Number },
      },
    ],
  });
}
