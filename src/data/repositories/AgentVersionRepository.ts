import type { Model } from 'mongoose';
import type { IAgentVersion, AgentVersionStatus } from '../../models/AgentVersion';
import { BaseRepository } from './BaseRepository';

export class AgentVersionRepository extends BaseRepository<IAgentVersion> {
  constructor(model: Model<IAgentVersion>) {
    super(model, 'agent_versions');
  }

  async findProduction(tenantId: string, agentId: string): Promise<IAgentVersion | null> {
    return this.findOne(tenantId, { agentId, status: 'production' } as any);
  }

  async findByVersion(tenantId: string, agentId: string, versionId: string): Promise<IAgentVersion | null> {
    return this.findOne(tenantId, { agentId, versionId } as any);
  }

  async listVersions(tenantId: string, agentId: string): Promise<IAgentVersion[]> {
    return (this.model as any)
      .find({ tenantId: this.toObjectId(tenantId), agentId })
      .sort({ createdAt: -1 })
      .lean() as Promise<IAgentVersion[]>;
  }

  async updateStatus(
    tenantId: string,
    agentId: string,
    versionId: string,
    update: { status?: AgentVersionStatus; trafficPercent?: number },
  ): Promise<void> {
    await (this.model as any).updateOne(
      { tenantId: this.toObjectId(tenantId), agentId, versionId },
      { $set: update },
    );
  }

  async retireOthers(tenantId: string, agentId: string, exceptVersionId: string): Promise<void> {
    await (this.model as any).updateMany(
      { tenantId: this.toObjectId(tenantId), agentId, versionId: { $ne: exceptVersionId }, status: { $ne: 'retired' } },
      { $set: { status: 'retired', trafficPercent: 0 } },
    );
  }

  /**
   * Cross-tenant lookup for the auto-rollback monitor. tenantId is resolved from the
   * returned document and never exposed externally. DeploymentController internals only.
   */
  async findByVersionSystemLevel(
    agentId: string,
    versionId: string,
    status: AgentVersionStatus,
  ): Promise<IAgentVersion | null> {
    return (this.model as any).findOne({ agentId, versionId, status }).lean() as Promise<IAgentVersion | null>;
  }
}
