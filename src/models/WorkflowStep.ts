import type { Document, Types } from 'mongoose';

export interface IWorkflowStep extends Document {
  deletedAt?: Date | null;
  tenantId: Types.ObjectId;
  workflowRunId: Types.ObjectId;
  stepType: string;
  inputSnapshot?: any;
  outputSnapshot?: any;
  createdAt: Date;
}

export function buildWorkflowStepSchema(m: typeof import('mongoose')) {
  const { Schema } = m;
  return new Schema(
    {
      deletedAt: { type: Date, default: null },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
      workflowRunId: { type: Schema.Types.ObjectId, ref: 'WorkflowRun', required: true, index: true },
      stepType: { type: String, required: true },
      inputSnapshot: { type: Schema.Types.Mixed },
      outputSnapshot: { type: Schema.Types.Mixed },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  );
}
