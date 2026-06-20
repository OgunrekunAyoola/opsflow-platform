import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import type { IDeviceToken, DevicePlatform } from '../../models/DeviceToken';

/** Expo push-token storage. Tenant-scoped; a token is globally unique (one device)
 *  and re-points to whichever user is logged in on it. Standalone (not BaseRepository)
 *  because lookups key on the globally-unique token, not tenantId. */
export class DeviceTokenRepository {
  constructor(private readonly model: Model<IDeviceToken>) {}

  async upsert(tenantId: string, userId: string, token: string, platform: DevicePlatform): Promise<void> {
    await (this.model as any).updateOne(
      { token },
      {
        $set: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          userId: new mongoose.Types.ObjectId(userId),
          platform,
        },
      },
      { upsert: true },
    );
  }

  async findTokensForUser(tenantId: string, userId: string): Promise<string[]> {
    const docs = await (this.model as any)
      .find({ tenantId: new mongoose.Types.ObjectId(tenantId), userId: new mongoose.Types.ObjectId(userId) })
      .select('token')
      .lean();
    return docs.map((d: any) => d.token as string);
  }

  async remove(token: string): Promise<void> {
    await (this.model as any).deleteOne({ token });
  }
}
