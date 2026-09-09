import { z } from 'zod';
import { ROLES } from '../models/User.js';

const objectId = z
  .string({ error: 'Invalid identifier.' })
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier.');

const role = z.enum(ROLES, { error: `Role must be one of: ${ROLES.join(', ')}.` });

const idParam = z.object({ id: objectId });

export const updateMeSchema = {
  // z.object strips unknown keys, so a client sending back a whole user object
  // cannot change its own role or status by accident — the extra fields are
  // discarded rather than rejected, per FRD 4.1.
  body: z.object({
    name: z
      .string({ error: 'Name is required.' })
      .trim()
      .min(2, 'Name must be between 2 and 60 characters.')
      .max(60, 'Name must be between 2 and 60 characters.'),
  }),
};

export const listUsersSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1, 'Page must be 1 or greater.').default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, 'Limit must be between 1 and 100.')
      .max(100, 'Limit must be between 1 and 100.')
      .default(20),
    role: role.optional(),
    search: z.string().trim().max(100, 'Search term is too long.').optional(),
  }),
};

export const changeRoleSchema = {
  params: idParam,
  body: z.object({ role }),
};

export const changeStatusSchema = {
  params: idParam,
  body: z.object({
    isActive: z.boolean({ error: 'isActive must be true or false.' }),
  }),
};

export const assignManagerSchema = {
  params: idParam,
  body: z.object({
    // null unassigns.
    managerId: objectId.nullable(),
  }),
};
