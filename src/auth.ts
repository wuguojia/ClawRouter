/**
 * Multi-Provider API Key Authentication
 *
 * Supports provider-specific API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
 * with fallback to BLOCKRUN_API_KEY for unified proxy access.
 */

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
 * Get API key for a specific provider.
 * Priority: provider-specific key > BLOCKRUN_API_KEY > undefined
 *
 * @param provider - Provider name (e.g., "openai", "anthropic")
 * @returns API key if found, undefined otherwise
 */
export function getProviderApiKey(provider: string): string | undefined {
  // Normalize provider name to lowercase
  const normalizedProvider = provider.toLowerCase();

  // Try provider-specific key first
  const providerEnvVar = PROVIDER_API_KEY_ENV[normalizedProvider];
  if (providerEnvVar) {
    const key = process.env[providerEnvVar];
    if (key) {
      return key;
    }
  }

  // Fallback to unified BlockRun API key
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
 * @param provider - Provider name
 * @returns API key
 */
export function requireProviderApiKey(provider: string): string {
  const key = getProviderApiKey(provider);
  if (!key) {
    const normalizedProvider = provider.toLowerCase();
    const providerEnvVar = PROVIDER_API_KEY_ENV[normalizedProvider];
    const suggestion = providerEnvVar
      ? `Set ${providerEnvVar} or ${BLOCKRUN_API_KEY_ENV} environment variable.`
      : `Set ${BLOCKRUN_API_KEY_ENV} environment variable.`;
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
 * Get all configured provider API keys
 * @returns Map of provider names to their API keys
 */
export function getConfiguredProviders(): Map<string, string> {
  const configured = new Map<string, string>();

  // Check all provider-specific keys
  for (const [provider, envVar] of Object.entries(PROVIDER_API_KEY_ENV)) {
    const key = process.env[envVar];
    if (key) {
      configured.set(provider, key);
    }
  }

  // Add BlockRun unified key if present
  const blockrunKey = process.env[BLOCKRUN_API_KEY_ENV];
  if (blockrunKey) {
    configured.set("blockrun", blockrunKey);
  }

  return configured;
}
