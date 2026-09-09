import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

/**
 * A throwaway hash, compared against when no account matches the submitted
 * email. Without it, a missing account would skip bcrypt entirely and return in
 * a fraction of the time a real password check takes — a timing side channel
 * that lets an attacker enumerate which emails are registered, which is exactly
 * what the identical error message is there to prevent.
 *
 * Computed once at startup, roughly 250ms.
 */
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 12);

/** Signs the session token. Payload is minimal — a JWT is signed, not encrypted. */
export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/** Milliseconds until the token expires, read back off the token itself so the
 *  cookie lifetime and the token lifetime can never drift apart. */
export function tokenLifetimeMs(token) {
  const { exp } = jwt.decode(token);
  return exp * 1000 - Date.now();
}

export async function register({ name, email, password }) {
  const existing = await User.findByEmail(email);
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.', 'EMAIL_EXISTS');
  }

  // Role is hardcoded, never taken from input. Promotion is an admin action.
  return User.create({ name, email, password, role: 'employee' });
}

export async function login({ email, password }) {
  const user = await User.findByEmail(email, { withPassword: true });

  const passwordMatches = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, DUMMY_HASH);

  // One message for both "no such account" and "wrong password". Telling them
  // apart would let anyone check whether a given email is registered here.
  if (!user || !passwordMatches) {
    throw ApiError.unauthorized('Incorrect email or password.', 'INVALID_CREDENTIALS');
  }

  // Checked after the password, so a deactivated account is not revealed to
  // someone who does not already know its password.
  if (!user.isActive) {
    throw ApiError.forbidden(
      'This account has been deactivated. Contact your administrator.',
      'ACCOUNT_DISABLED'
    );
  }

  return user;
}
