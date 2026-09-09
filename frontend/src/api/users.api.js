import client from './client.js';

export async function updateOwnProfile(payload) {
  const { data } = await client.patch('/users/me', payload);
  return data.data.user;
}

export async function listUsers(params) {
  const { data } = await client.get('/users', { params });
  return data.data;
}

export async function getStats() {
  const { data } = await client.get('/users/stats');
  return data.data;
}

export async function changeRole(id, role) {
  const { data } = await client.patch(`/users/${id}/role`, { role });
  return data.data.user;
}

export async function changeStatus(id, isActive) {
  const { data } = await client.patch(`/users/${id}/status`, { isActive });
  return data.data.user;
}

export async function assignManager(id, managerId) {
  const { data } = await client.patch(`/users/${id}/manager`, { managerId });
  return data.data.user;
}

export async function getTeam() {
  const { data } = await client.get('/users/team');
  return data.data;
}
