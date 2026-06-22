import type { Model } from 'mongoose';
import type { ApprovalStatus } from '@opsflow/contracts';
import type { IApproval } from '../../models/Approval';
import { BaseRepository } from './BaseRepository';

/** Thrown when an approval is decided twice (double-decision protection, HITL G2). */
export class InvalidApprovalTransitionError extends Error {
  constructor(id: string, from: ApprovalStatus, to: ApprovalStatus) {
    super(`Approval ${id} is "${from}" — cannot transition to "${to}" (already decided)`);
    this.name = 'InvalidApprovalTransitionError';
  }
}

export class ApprovalRepository extends BaseRepository<IApproval> {
  constructor(model: Model<IApproval>) {
    super(model, 'approvals');
  }

  findPendingByTicket(tenantId: string, ticketId: string): Promise<IApproval | null> {
    return this.findOne(tenantId, { ticketId: this.toObjectId(ticketId), status: 'pending' } as any);
  }

  listPending(tenantId: string): Promise<IApproval[]> {
    return this.find(tenantId, { status: 'pending' } as any);
  }

  /**
   * Transition a pending approval to a terminal status (approved/rejected/expired).
   * Guarded: only `pending` may be decided — a second decision throws
   * InvalidApprovalTransitionError (so a race between a human click and the timeout job
   * can't double-resolve). Returns the updated doc.
   */
  async decide(
    tenantId: string,
    id: string,
    status: Exclude<ApprovalStatus, 'pending'>,
    decidedBy?: string,
    decisionReason?: string,
  ): Promise<IApproval> {
    const existing = await this.findById(tenantId, id);
    if (!existing) throw new Error(`Approval ${id} not found`);
    if (existing.status !== 'pending') {
      throw new InvalidApprovalTransitionError(id, existing.status, status);
    }
    const updated = await this.updateById(tenantId, id, {
      $set: { status, decidedBy, decisionReason },
    } as any);
    return updated as IApproval;
  }
}
