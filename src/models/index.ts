// Model schemas (builders) + document interfaces. The host app registers them on
// its own mongoose instance via mongoose.model('X', buildXSchema(mongoose)).
export { buildUserSchema, type IUser } from './User';
