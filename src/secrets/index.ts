export { SecretsProvider, SecretNotFoundError } from './SecretsProvider';
export type { SecretScope } from './SecretsProvider';
export { EnvSecretsProvider } from './EnvSecretsProvider';
import { EnvSecretsProvider } from './EnvSecretsProvider';

// Singleton — replaced by production provider when OPSFLOW_SECRETS_PROVIDER is set.
// Steps 4–5 will swap this out for Vault/AWS without changing call sites.
export const secrets = new EnvSecretsProvider();
