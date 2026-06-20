import type { Model } from 'mongoose';
import type { IAgentMemory } from '../../models/AgentMemory';
import { BaseRepository } from './BaseRepository';
import type { AgentMemory as AgentMemoryState } from '@opsflow/contracts';

export class AgentMemoryRepository extends BaseRepository<IAgentMemory> {
  constructor(model: Model<IAgentMemory>) {
    super(model, 'agent_memories');
  }

  /** Find long-term memory record for a customer (ADR-017). */
  async findByCustomer(tenantId: string, canonicalCustomerId: string): Promise<IAgentMemory | null> {
    return this.findOne(tenantId, { canonicalCustomerId } as any);
  }

  /**
   * Upsert customer memory after a ticket resolution.
   * Merges resolvedCategories into the set, increments interaction count.
   * tenantId is always in the filter — never written without it.
   */
  async upsertResolution(
    tenantId: string,
    canonicalCustomerId: string,
    update: Partial<AgentMemoryState>,
  ): Promise<void> {
    const now = new Date();
    const retentionDays = parseInt(process.env.AGENT_MEMORY_RETENTION_DAYS ?? '730', 10);
    const expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);

    await (this.model as any).findOneAndUpdate(
      { tenantId: this.toObjectId(tenantId), canonicalCustomerId },
      {
        $set: { lastUpdatedAt: now, expiresAt, ...update },
        $inc: { totalInteractions: 1 },
        ...(update.resolvedCategories?.length
          ? { $addToSet: { resolvedCategories: { $each: update.resolvedCategories } } }
          : {}),
      },
      { upsert: true, new: true },
    );
  }
}
