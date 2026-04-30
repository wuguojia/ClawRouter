/**
 * Multi-Provider API Key Authentication
 *
 * Three-tier configuration priority:
 * 1. Configuration file (~/.clawrouter/providers.json)
 * 2. Environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
 * 3. Unified proxy (BLOCKRUN_API_KEY)
 */

import { loadProviders } from "./config/loader.js";
import type { ProviderConfig } from "./config/types.js";

/**
 * Provider-specific API key environment variables
 */
export const PROVIDER_API_KEY_ENV: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  gemini: "GOOGLE_API_KEY", // alias
  xai: "XAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
  kimi: "MOONSHOT_API_KEY", // alias
  nvidia: "NVIDIA_API_KEY",
  mistral: "MISTRAL_API_KEY",
  cohere: "COHERE_API_KEY",
};

/**
 * Fallback API key for unified BlockRun proxy
 */
const BLOCKRUN_API_KEY_ENV = "BLOCKRUN_API_KEY";

/**
 * Get provider configuration by ID from config file.
 *
 * @param providerId - Provider ID (e.g., "openai-official", "azure-openai")
 * @returns ProviderConfig if found, undefined otherwise
 */
export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  const providers = loadProviders();
  return providers.find(p => p.id === providerId && p.enabled !== false);
}

/**
 * Get all provider configurations from config file.
 *
 * @returns Array of enabled ProviderConfig
 */
export function getAllProviderConfigs(): ProviderConfig[] {
  const providers = loadProviders();
  return providers.filter(p => p.enabled !== false);
}

/**
 * Get API key for a specific provider.
 * Priority:
 * 1. Configuration file (by provider ID)
 * 2. Environment variable (by provider format/name)
 * 3. BLOCKRUN_API_KEY (unified fallback)
 *
 * @param provider - Provider ID or format name (e.g., "openai-official", "openai", "anthropic")
 * @returns API key if found, undefined otherwise
 */
export function getProviderApiKey(provider: string): string | undefined {
  // 1. Try config file first (by provider ID)
  const providerConfig = getProviderConfig(provider);
  if (providerConfig?.apiKey) {
    return providerConfig.apiKey;
  }

  // 2. Try environment variable (by format/name)
  const normalizedProvider = provider.toLowerCase();
  const providerEnvVar = PROVIDER_API_KEY_ENV[normalizedProvider];
  if (providerEnvVar) {
    const key = process.env[providerEnvVar];
    if (key) {
      return key;
    }
  }

  // 3. Fallback to unified BlockRun API key
  return process.env[BLOCKRUN_API_KEY_ENV];
}

/**
 * Get the generic BlockRun API key (for backward compatibility).
 * Returns undefined if not set.
 */
export function getApiKey(): string | undefined {
  return process.env[BLOCKRUN_API_KEY_ENV];
}

/**
 * Validate that an API key is configured for a provider.
 * Throws an error if not found.
 *
 * @param provider - Provider ID or format name
 * @returns API key
 */
export function requireProviderApiKey(provider: string): string {
  const key = getProviderApiKey(provider);
  if (!key) {
    const normalizedProvider = provider.toLowerCase();
    const providerEnvVar = PROVIDER_API_KEY_ENV[normalizedProvider];
    const suggestion = providerEnvVar
      ? `Set ${providerEnvVar} or ${BLOCKRUN_API_KEY_ENV} environment variable, or add provider to ~/.clawrouter/providers.json`
      : `Set ${BLOCKRUN_API_KEY_ENV} environment variable or add provider to ~/.clawrouter/providers.json`;
    throw new Error(
      `API key not found for provider "${provider}". ${suggestion}`
    );
  }
  return key;
}

/**
 * Validate that a generic API key is configured.
 * Throws an error if not found.
 */
export function requireApiKey(): string {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      `API key not found. Set ${BLOCKRUN_API_KEY_ENV} environment variable.`
    );
  }
  return key;
}

/**
 * Get all configured providers (from both config file and environment variables).
 * Returns full ProviderConfig objects for config file providers,
 * and simplified configs for environment variable providers.
 *
 * @returns Array of ProviderConfig
 */
export function getConfiguredProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  // 1. Load providers from config file
  const fileProviders = getAllProviderConfigs();
  providers.push(...fileProviders);

  // 2. Add environment variable providers (if not already in config file)
  const configProviderIds = new Set(providers.map(p => p.id));
  const configProviderFormats = new Set(providers.map(p => p.format));

  for (const [provider, envVar] of Object.entries(PROVIDER_API_KEY_ENV)) {
    const key = process.env[envVar];
    if (key && !configProviderIds.has(provider) && !configProviderFormats.has(provider as any)) {
      // Create a simplified provider config from environment variable
      providers.push({
        id: provider,
        name: provider.charAt(0).toUpperCase() + provider.slice(1),
        format: provider as any, // Assume format matches provider name
        baseUrl: "", // Will need to be set by user or inferred
        apiKey: key,
        models: [],
        enabled: true,
      });
    }
  }

  // 3. Add BlockRun unified key if present and no other providers configured
  const blockrunKey = process.env[BLOCKRUN_API_KEY_ENV];
  if (blockrunKey && providers.length === 0) {
    providers.push({
      id: "blockrun",
      name: "BlockRun Unified",
      format: "openai",
      baseUrl: "",
      apiKey: blockrunKey,
      models: [],
      enabled: true,
    });
  }

  return providers;
}
