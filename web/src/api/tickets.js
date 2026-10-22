import { request } from './client.js';

export async function getTickets(params = {}) {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.assigned) query.set('assigned', params.assigned);
  if (params.q) query.set('q', params.q);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);

  const qs = query.toString();
  const endpoint = qs ? `/tickets?${qs}` : '/tickets';
  const res = await request(endpoint, { method: 'GET' });
  return res.data;
}

export async function getTicketDetail(id) {
  const res = await request(`/tickets/${id}`, { method: 'GET' });
  return res.data;
}

export async function getTicketMessages(id, after = null) {
  const endpoint = after ? `/tickets/${id}/messages?after=${after}` : `/tickets/${id}/messages`;
  const res = await request(endpoint, { method: 'GET' });
  return res.data;
}

export async function claimTicket(id) {
  const res = await request(`/tickets/${id}/claim`, { method: 'POST' });
  return res.data;
}

export async function releaseTicket(id) {
  const res = await request(`/tickets/${id}/release`, { method: 'POST' });
  return res.data;
}

export async function assignTicket(id, agentId) {
  const res = await request(`/tickets/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  });
  return res.data;
}

export async function updateTicket(id, payload) {
  const res = await request(`/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}
