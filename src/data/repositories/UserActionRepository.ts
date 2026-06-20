import type { Model } from 'mongoose';
import type { IUserAction } from '../../models/UserAction';
import { BaseRepository } from './BaseRepository';

export class UserActionRepository extends BaseRepository<IUserAction> {
  constructor(model: Model<IUserAction>) {
    super(model, 'user_actions');
  }
}
