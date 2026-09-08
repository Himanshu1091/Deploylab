import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment is validated once, at startup.
 *
 * Failing here is deliberate: a missing JWT_SECRET should stop the process with a
 * readable message, not surface hours later as a cryptic "jwt malformed" during
 * someone's first login attempt on a fresh server.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required (Atlas connection string)'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters — generate with: openssl rand -hex 32'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  SEED_ADMIN_EMAIL: z.string().default('admin@deploylab.local'),
  SEED_ADMIN_PASSWORD: z.string().default('Admin123pass'),
  SEED_MANAGER_EMAIL: z.string().default('manager@deploylab.local'),
  SEED_MANAGER_PASSWORD: z.string().default('Manager123pass'),
  SEED_EMPLOYEE_EMAIL: z.string().default('employee@deploylab.local'),
  SEED_EMPLOYEE_PASSWORD: z.string().default('Employee123pass'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n  Invalid environment configuration:\n');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\n  Copy server/.env.example to server/.env and fill in the values.\n');
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isDev: parsed.data.NODE_ENV === 'development',
};
