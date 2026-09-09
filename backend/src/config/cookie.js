import { env } from './env.js';

export const COOKIE_NAME = 'token';

/**
 * Session cookie attributes.
 *
 * httpOnly  — unreadable by JavaScript, so an injected script cannot steal the
 *             token the way it could from localStorage.
 * secure    — HTTPS only. A browser silently discards a Secure cookie delivered
 *             over plain HTTP, so this cannot simply follow NODE_ENV: a
 *             production deployment without TLS would appear to log in and then
 *             fail on the next authenticated request.
 *
 *             It therefore has its own setting. COOKIE_SECURE overrides;
 *             otherwise it follows NODE_ENV, which is the right default.
 *             Turning it off means the session token crosses the network in
 *             plaintext and anyone on the path can replay it — only acceptable
 *             on a throwaway deployment, and the reason TLS is the real fix.
 * sameSite  — lax. Combined with same-origin deployment this covers CSRF for
 *             this threat model: a cross-site POST will not carry the cookie.
 *
 * maxAge is derived from the token itself by the caller, so the cookie and the
 * token can never expire at different times.
 */
export function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE ?? env.isProd,
    sameSite: 'lax',
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}
