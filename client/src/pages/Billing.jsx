import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Billing() {
  const { user, setUserPlan, refresh } = useAuth();
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();

  useEffect(() => {
    api.billingStatus().then(setStatus).catch((e) => setError(e.message));
    if (params.get('success')) setMsg('Checkout completed — refreshing plan…');
    if (params.get('canceled')) setMsg('Checkout canceled.');
  }, [params]);

  useEffect(() => {
    if (params.get('success')) refresh();
  }, [params, refresh]);

  async function upgrade() {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const result = await api.checkout();
      if (result.mode === 'stripe' && result.url) {
        window.location.href = result.url;
        return;
      }
      setUserPlan('pro');
      setMsg(result.message || 'Upgraded to Pro (mock).');
      const s = await api.billingStatus();
      setStatus(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function downgrade() {
    setBusy(true);
    setError('');
    try {
      const { user: u } = await api.mockDowngrade();
      setUserPlan(u.plan);
      setMsg('Returned to Free (mock only).');
      setStatus(await api.billingStatus());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const plan = user?.plan || status?.plan || 'free';
  const stripeMode = status?.stripeMode || 'mock';

  return (
    <div className="billing">
      <h1>Billing</h1>
      <p className="muted">
        Current plan: <strong>{plan === 'pro' ? 'Pro' : 'Free'}</strong>
        {stripeMode === 'mock' && ' · Stripe keys not set — mock upgrade enabled'}
      </p>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="error">{error}</p>}

      <div className="grid-2">
        <div className={`card plan-card ${plan === 'free' ? 'current' : ''}`}>
          <h2>Free</h2>
          <p className="price">$0</p>
          <ul>
            <li>Account + session auth</li>
            <li>First 5 literacy steps</li>
            <li>Progress %</li>
          </ul>
        </div>
        <div className={`card plan-card ${plan === 'pro' ? 'current' : ''}`}>
          <h2>Pro</h2>
          <p className="price">$19/mo</p>
          <ul>
            <li>All 10 checklist steps</li>
            <li>Short notes per step</li>
            <li>Monthly review focus</li>
          </ul>
          {plan !== 'pro' ? (
            <button type="button" className="btn primary" disabled={busy} onClick={upgrade}>
              {busy
                ? 'Working…'
                : stripeMode === 'mock'
                  ? 'Mock upgrade to Pro'
                  : 'Upgrade with Stripe'}
            </button>
          ) : (
            <p className="ok">You are on Pro.</p>
          )}
        </div>
      </div>

      {plan === 'pro' && stripeMode === 'mock' && (
        <p className="muted pad-top">
          <button type="button" className="btn ghost small" disabled={busy} onClick={downgrade}>
            Mock downgrade to Free
          </button>
        </p>
      )}

      <aside className="disclaimer">
        Cancel anytime when Stripe is live via Customer Portal (not wired until keys + webhook).
        Educational product only — no crypto payments, no custody.
      </aside>
      <p>
        <Link to="/app">← Back to checklist</Link>
      </p>
    </div>
  );
}
