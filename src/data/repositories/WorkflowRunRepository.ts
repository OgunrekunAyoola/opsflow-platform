import type { Model } from 'mongoose';
import type { IWorkflowRun } from '../../models/WorkflowRun';
import { BaseRepository } from './BaseRepository';

export class WorkflowRunRepository extends BaseRepository<IWorkflowRun> {
  constructor(model: Model<IWorkflowRun>) {
    super(model, 'workflow_runs');
  }

  /** All runs for a ticket, newest first. */
  async findByTicket(tenantId: string, ticketId: string): Promise<IWorkflowRun[]> {
    return (this.model as any)
      .find({ tenantId: this.toObjectId(tenantId), ticketId })
      .sort({ startedAt: -1 })
      .lean()
      .exec() as Promise<IWorkflowRun[]>;
  }
}
