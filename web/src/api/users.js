import { request } from './client.js';

export async function getUsers() {
  const res = await request('/users', { method: 'GET' });
  return res.data;
}

export async function createUser(data) {
  const res = await request('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateUser(id, data) {
  const res = await request(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}
