import type { Model } from 'mongoose';
import type { IWorkflowStep } from '../../models/WorkflowStep';
import { BaseRepository } from './BaseRepository';

export class WorkflowStepRepository extends BaseRepository<IWorkflowStep> {
  constructor(model: Model<IWorkflowStep>) {
    super(model, 'workflow_steps');
  }

  /** All steps for a workflow run, oldest first (execution order). */
  async findByRun(tenantId: string, workflowRunId: string): Promise<IWorkflowStep[]> {
    return (this.model as any)
      .find({ tenantId: this.toObjectId(tenantId), workflowRunId })
      .sort({ createdAt: 1 })
      .lean()
      .exec() as Promise<IWorkflowStep[]>;
  }
}
