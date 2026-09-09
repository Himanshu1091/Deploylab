import client from './client.js';

export async function register(payload) {
  const { data } = await client.post('/auth/register', payload);
  return data.data.user;
}

export async function login(payload) {
  const { data } = await client.post('/auth/login', payload);
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
