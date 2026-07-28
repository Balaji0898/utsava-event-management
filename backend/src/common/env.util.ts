/**
 * Read a required secret from the environment, failing closed. Throws on boot if
 * the variable is missing/blank or is one of the well-known insecure placeholder
 * values — so a misconfigured deploy crashes loudly instead of silently signing
 * JWTs with a public default (which would allow token forgery / admin takeover).
 */
const INSECURE_PLACEHOLDERS = new Set([
  'change_me',
  'change_me_access_secret',
  'change_me_refresh_secret',
  'dev_access_secret_change_me',
  'dev_refresh_secret_change_me',
  'secret',
  'changeme',
]);

export function requireSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Set a strong random value (e.g. \`openssl rand -base64 48\`).`,
    );
  }
  if (INSECURE_PLACEHOLDERS.has(value.toLowerCase())) {
    throw new Error(
      `Environment variable ${name} is set to an insecure placeholder. Set a strong random value (e.g. \`openssl rand -base64 48\`).`,
    );
  }
  return value;
}
