import type { Model } from 'mongoose';
import type { IClient } from '../../models/Client';
import { BaseRepository } from './BaseRepository';

export class ClientRepository extends BaseRepository<IClient> {
  constructor(model: Model<IClient>) {
    super(model, 'clients', true); // soft-delete enabled
  }
}
