// Repository layer (ADR-077). BaseRepository + concrete repo CLASSES; the host
// instantiates singletons with its registered models (P2/2c).
export type { IRepository } from './IRepository';
export { BaseRepository } from './BaseRepository';
export { UserRepository } from './UserRepository';
