import { z } from 'zod';

// Messages are written to be shown to a user verbatim, so the validate
// middleware can pass the first one straight through without rewording.

const name = z
  .string({ error: 'Name is required.' })
  .trim()
  .min(2, 'Name must be between 2 and 60 characters.')
  .max(60, 'Name must be between 2 and 60 characters.');

const email = z
  .email({ error: 'Enter a valid email address.' })
  .max(254, 'Enter a valid email address.')
  .transform((value) => value.toLowerCase().trim());

// 72 is bcrypt's ceiling — it silently truncates beyond that, so accepting
// longer input would give a false sense of strength.
const password = z
  .string({ error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters and include a letter and a number.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[A-Za-z]/, 'Password must be at least 8 characters and include a letter and a number.')
  .regex(/[0-9]/, 'Password must be at least 8 characters and include a letter and a number.');

export const registerSchema = {
  // Role is deliberately absent. Accepting it here would be a one-line
  // privilege escalation: anyone could register themselves as an admin.
  body: z.object({ name, email, password }),
};

export const loginSchema = {
  body: z.object({
    email: z.string({ error: 'Email and password are required.' }).min(1, 'Email and password are required.'),
    password: z.string({ error: 'Email and password are required.' }).min(1, 'Email and password are required.'),
  }),
};
