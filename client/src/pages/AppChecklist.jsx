import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function AppChecklist() {
  const { user, setUserPlan } = useAuth();
  const [steps, setSteps] = useState([]);
  const [progress, setProgress] = useState({});
  const [percent, setPercent] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');
  const [noteDrafts, setNoteDrafts] = useState({});
  const [saving, setSaving] = useState(null);
  const isPro = user?.plan === 'pro';

  async function load() {
    setError('');
    try {
      const [s, p] = await Promise.all([api.steps(), api.progress()]);
      setSteps(s.steps || []);
      setProgress(p.progress || {});
      setPercent(p.percent || 0);
      if (p.plan) setUserPlan(p.plan);
      const drafts = {};
      for (const [id, val] of Object.entries(p.progress || {})) {
        drafts[id] = val.note || '';
      }
      setNoteDrafts(drafts);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(step) {
    if (!step.free && !isPro) return;
    const current = progress[step.id]?.completed;
    setSaving(step.id);
    setError('');
    try {
      await api.setProgress(step.id, { completed: !current });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  async function saveNote(step) {
    if (!isPro) return;
    setSaving(step.id);
    setError('');
    try {
      await api.setProgress(step.id, {
        completed: Boolean(progress[step.id]?.completed),
        note: noteDrafts[step.id] || '',
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="checklist">
      <div className="checklist-head">
        <div>
          <h1>Literacy checklist</h1>
          <p className="muted">
            Check steps as you learn them offline. Never paste seeds — there is no seed field.
          </p>
        </div>
        <div className="progress-ring" aria-label={`Progress ${percent}%`}>
          <span className="progress-num">{percent}%</span>
          <span className="muted small">of unlocked steps</span>
        </div>
      </div>

      <div className="banner calm">
        <strong>Reminder:</strong> Educational only. Not advice to buy, sell, or move funds. Do not
        enter recovery phrases anywhere on this site.
      </div>

      {error && <p className="error">{error}</p>}

      <ul className="step-list">
        {steps.map((step) => {
          const locked = !step.free && !isPro;
          const done = Boolean(progress[step.id]?.completed);
          const open = openId === step.id;
          return (
            <li key={step.id} className={`step card ${locked ? 'locked' : ''} ${done ? 'done' : ''}`}>
              <div className="step-row">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={locked || saving === step.id}
                    onChange={() => toggle(step)}
                  />
                  <span>
                    <span className="step-order">{step.order}.</span> {step.title}
                    {step.free ? (
                      <span className="tag free">Free</span>
                    ) : (
                      <span className="tag pro">Pro</span>
                    )}
                  </span>
                </label>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setOpenId(open ? null : step.id)}
                >
                  {open ? 'Hide' : 'Why'}
                </button>
              </div>
              <p className="summary">{step.summary}</p>
              {locked && (
                <p className="lock-msg">
                  Locked on Free. <Link to="/billing">Upgrade to Pro</Link> to unlock.
                </p>
              )}
              {open && (
                <div className="why">
                  <p>{step.why}</p>
                  {isPro && !locked && (
                    <div className="note-box">
                      <label>
                        Short note (Pro) — never seeds or keys
                        <textarea
                          rows={2}
                          maxLength={500}
                          placeholder="e.g. Reviewed bookmarks this month"
                          value={noteDrafts[step.id] || ''}
                          onChange={(e) =>
                            setNoteDrafts((d) => ({ ...d, [step.id]: e.target.value }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn small"
                        disabled={saving === step.id}
                        onClick={() => saveNote(step)}
                      >
                        Save note
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
