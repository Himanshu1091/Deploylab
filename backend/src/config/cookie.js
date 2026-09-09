import { env } from './env.js';

export const COOKIE_NAME = 'token';

/**
 * Session cookie attributes.
 *
 * httpOnly  — unreadable by JavaScript, so an injected script cannot steal the
 *             token the way it could from localStorage.
 * secure    — production only. Set over plain HTTP the browser drops the cookie
 *             silently, which is why NODE_ENV=production must not be switched on
 *             before TLS is working.
 * sameSite  — lax. Combined with same-origin deployment this covers CSRF for
 *             this threat model: a cross-site POST will not carry the cookie.
 *
 * maxAge is derived from the token itself by the caller, so the cookie and the
 * token can never expire at different times.
 */
export function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}
