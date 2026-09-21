async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/api/health'),
  steps: () => request('/api/steps'),
  me: () => request('/api/auth/me'),
  signup: (email, password) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  progress: () => request('/api/progress'),
  setProgress: (stepId, body) =>
    request(`/api/progress/${stepId}`, { method: 'PUT', body: JSON.stringify(body) }),
  billingStatus: () => request('/api/billing/status'),
  checkout: () => request('/api/billing/checkout', { method: 'POST' }),
  mockDowngrade: () => request('/api/billing/mock-downgrade', { method: 'POST' }),
};
