/**
 * Smoke test: signup → login → progress → mock Pro
 * Requires server already listening on PORT (default 3001).
 */
const BASE = process.env.API_BASE || 'http://localhost:3001';

async function req(path, { method = 'GET', body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, setCookie };
}

function extractSid(setCookie) {
  const line = setCookie.find((c) => c.startsWith('custodysteps.sid='));
  if (!line) return null;
  return line.split(';')[0];
}

async function main() {
  const email = `smoke_${Date.now()}@example.com`;
  const password = 'testpass99';

  const health = await req('/api/health');
  if (health.status !== 200) throw new Error('Server not healthy: ' + health.status);

  const signup = await req('/api/auth/signup', {
    method: 'POST',
    body: { email, password },
  });
  if (signup.status !== 201) throw new Error('Signup failed: ' + JSON.stringify(signup.json));
  let cookie = extractSid(signup.setCookie);
  if (!cookie) throw new Error('No session cookie on signup');

  await req('/api/auth/logout', { method: 'POST', cookie });

  const login = await req('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (login.status !== 200) throw new Error('Login failed');
  cookie = extractSid(login.setCookie);

  const stepId = 'password-manager';
  const put = await req(`/api/progress/${stepId}`, {
    method: 'PUT',
    cookie,
    body: { completed: true },
  });
  if (put.status !== 200) throw new Error('Progress put failed: ' + JSON.stringify(put.json));

  const prog = await req('/api/progress', { cookie });
  if (!prog.json.progress?.[stepId]?.completed) throw new Error('Progress not persisted');

  const checkout = await req('/api/billing/checkout', { method: 'POST', cookie });
  if (checkout.status !== 200 || checkout.json.user?.plan !== 'pro') {
    throw new Error('Mock Pro failed: ' + JSON.stringify(checkout.json));
  }

  console.log('SMOKE OK', {
    email,
    plan: checkout.json.user.plan,
    percent: prog.json.percent,
    db: health.json.db,
    stripe: health.json.stripe,
  });
}

main().catch((e) => {
  console.error('SMOKE FAIL', e.message);
  process.exit(1);
});
