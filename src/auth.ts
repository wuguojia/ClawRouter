/**
 * Simple API Key Authentication
 *
 * Reads API key from BLOCKRUN_API_KEY environment variable.
 */

const API_KEY_ENV = "BLOCKRUN_API_KEY";

/**
 * Get API key from environment variable.
 * Returns undefined if not set.
 */
export function getApiKey(): string | undefined {
  return process.env[API_KEY_ENV];
}

/**
 * Validate that an API key is configured.
 * Throws an error if not found.
 */
export function requireApiKey(): string {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      `API key not found. Set ${API_KEY_ENV} environment variable.`
    );
  }
  return key;
}
