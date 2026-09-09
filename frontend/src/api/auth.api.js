import client from './client.js';

export async function register(payload) {
  const { data } = await client.post('/auth/register', payload, { skipAuthRedirect: true });
  return data.data.user;
}

/**
 * skipAuthRedirect: a 401 here means the credentials were wrong, not that a
 * session ended. Without the flag the shared interceptor treats a failed login
 * as an expiry, sets the session-expired notice, and stacks it above the real
 * error message.
 */
export async function login(payload) {
  const { data } = await client.post('/auth/login', payload, { skipAuthRedirect: true });
  return data.data.user;
}

export async function logout() {
  await client.post('/auth/logout');
}

/**
 * skipAuthRedirect: a 401 here means "not logged in", which is a normal state
 * on first load, not an expired session to redirect away from.
 */
export async function me() {
  const { data } = await client.get('/auth/me', { skipAuthRedirect: true });
  return data.data.user;
}
