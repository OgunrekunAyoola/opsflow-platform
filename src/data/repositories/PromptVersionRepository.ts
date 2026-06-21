import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import type { IPromptVersion } from '../../models/PromptVersion';

/**
 * Standalone (not BaseRepository) because PromptVersion uses tenantId: null for
 * global defaults. Tenant methods enforce tenantId explicitly; global lookups are
 * named *Global().
 */
export class PromptVersionRepository {
  constructor(private readonly model: Model<IPromptVersion>) {}

  async findActiveForTenant(tenantId: string, name: string): Promise<IPromptVersion | null> {
    return (this.model as any)
      .findOne({ tenantId: new mongoose.Types.ObjectId(tenantId), name, isActive: true })
      .sort({ version: -1 })
      .lean() as Promise<IPromptVersion | null>;
  }

  async findActiveGlobal(name: string): Promise<IPromptVersion | null> {
    return (this.model as any)
      .findOne({ tenantId: null, name, isActive: true })
      .sort({ version: -1 })
      .lean() as Promise<IPromptVersion | null>;
  }

  async findById(id: string): Promise<IPromptVersion | null> {
    return (this.model as any).findById(id).lean() as Promise<IPromptVersion | null>;
  }

  async findLatest(tenantId: string | null, name: string): Promise<IPromptVersion | null> {
    const filter = tenantId
      ? { tenantId: new mongoose.Types.ObjectId(tenantId), name }
      : { tenantId: null, name };
    return (this.model as any).findOne(filter).sort({ version: -1 }).lean() as Promise<IPromptVersion | null>;
  }

  async deactivateAll(tenantId: string | null, name: string): Promise<void> {
    const filter = tenantId
      ? { tenantId: new mongoose.Types.ObjectId(tenantId), name, isActive: true }
      : { tenantId: null, name, isActive: true };
    await (this.model as any).updateMany(filter, { $set: { isActive: false } });
  }

  async create(data: {
    tenantId: string | null;
    name: string;
    version: number;
    content: string;
    isActive: boolean;
    createdBy?: string;
  }): Promise<IPromptVersion> {
    const doc = await (this.model as any).create({
      ...data,
      tenantId: data.tenantId ? new mongoose.Types.ObjectId(data.tenantId) : null,
    });
    return doc.toObject() as IPromptVersion;
  }
}
