// Fail fast at boot when the environment is unsafe or incomplete.

// Values that were published in the repository history: never accept them.
const LEAKED_SECRETS = new Set([
  'trust-auto-super-secret-jwt-key-2025',
  'trust-auto-refresh-secret-key-2025',
]);

export function validateEnv(config: Record<string, unknown>) {
  const errors: string[] = [];
  const isProd = config.NODE_ENV === 'production';

  if (!config.DATABASE_URL) errors.push('DATABASE_URL is required');

  const jwtSecret = String(config.JWT_SECRET ?? '');
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else if (LEAKED_SECRETS.has(jwtSecret)) {
    errors.push('JWT_SECRET is a value that was published in git history; generate a new one');
  } else if (isProd && jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production');
  }

  if (isProd && !config.CORS_ORIGIN) {
    errors.push('CORS_ORIGIN is required in production (comma-separated list of allowed origins)');
  }

  const sameSite = config.COOKIE_SAMESITE;
  if (sameSite && !['lax', 'strict', 'none'].includes(String(sameSite))) {
    errors.push('COOKIE_SAMESITE must be one of lax, strict, none');
  }

  if (errors.length) {
    throw new Error(`Invalid environment:\n - ${errors.join('\n - ')}`);
  }
  return config;
}

export function corsOrigins(): string[] {
  return (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
