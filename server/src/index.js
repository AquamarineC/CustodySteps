import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, getDbImpl } from './db.js';
import { LITERACY_STEPS, FREE_STEP_COUNT } from './steps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-change-me';
const hasStripe =
  Boolean(process.env.STRIPE_SECRET_KEY) && Boolean(process.env.STRIPE_PRICE_ID);

let stripe = null;

const app = express();

// Stripe webhook needs raw body — mount before json parser if used
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(400).json({ error: 'Webhook not configured' });
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature failed', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    const database = await getDb();
    if (event.type === 'checkout.session.completed') {
      const sessionObj = event.data.object;
      const userId = sessionObj.client_reference_id || sessionObj.metadata?.userId;
      if (userId) {
        database.prepare(`UPDATE users SET plan = 'pro' WHERE id = ?`).run(Number(userId));
      }
    }
    res.json({ received: true });
  }
);

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(
  session({
    name: 'custodysteps.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    plan: row.plan,
    createdAt: row.created_at,
  };
}

app.get('/api/health', async (_req, res) => {
  await getDb();
  res.json({
    ok: true,
    db: getDbImpl(),
    stripe: hasStripe ? 'configured' : 'mock',
    freeSteps: FREE_STEP_COUNT,
    totalSteps: LITERACY_STEPS.length,
  });
});

app.get('/api/steps', (_req, res) => {
  res.json({
    steps: LITERACY_STEPS.map(({ id, order, free, title, summary, why }) => ({
      id,
      order,
      free,
      title,
      summary,
      why,
    })),
    freeStepCount: FREE_STEP_COUNT,
  });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !email.includes('@') || password.length < 8) {
      return res
        .status(400)
        .json({ error: 'Valid email and password (8+ chars) required.' });
    }
    const database = await getDb();
    const existing = database.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const result = database
      .prepare('INSERT INTO users (email, password_hash, plan) VALUES (?, ?, ?)')
      .run(email, password_hash, 'free');
    req.session.userId = Number(result.lastInsertRowid);
    const user = database.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error('signup', err);
    res.status(500).json({ error: 'Signup failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    const database = await getDb();
    const user = database.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    req.session.userId = user.id;
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('login', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('custodysteps.sid');
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session?.userId) {
    return res.json({ user: null });
  }
  const database = await getDb();
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }
  res.json({ user: publicUser(user) });
});

app.get('/api/progress', requireAuth, async (req, res) => {
  const database = await getDb();
  const rows = database
    .prepare('SELECT step_id, completed, note FROM progress WHERE user_id = ?')
    .all(req.session.userId);
  const byId = Object.fromEntries(
    rows.map((r) => [
      r.step_id,
      { completed: Boolean(r.completed), note: r.note || '' },
    ])
  );
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  const isPro = user?.plan === 'pro';
  const visible = LITERACY_STEPS.filter((s) => s.free || isPro);
  const completedCount = visible.filter((s) => byId[s.id]?.completed).length;
  const percent =
    visible.length === 0 ? 0 : Math.round((completedCount / visible.length) * 100);
  res.json({
    progress: byId,
    percent,
    completedCount,
    visibleCount: visible.length,
    plan: user.plan,
  });
});

app.put('/api/progress/:stepId', requireAuth, async (req, res) => {
  const stepId = req.params.stepId;
  const step = LITERACY_STEPS.find((s) => s.id === stepId);
  if (!step) {
    return res.status(404).json({ error: 'Unknown step.' });
  }
  const database = await getDb();
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!step.free && user.plan !== 'pro') {
    return res.status(403).json({ error: 'Pro plan required for this step.' });
  }

  const completed =
    req.body?.completed === undefined ? true : Boolean(req.body.completed);
  let note = typeof req.body?.note === 'string' ? req.body.note : undefined;

  // Notes are Pro-only; never accept seed-like blobs
  if (note !== undefined) {
    if (user.plan !== 'pro') {
      return res.status(403).json({ error: 'Notes require Pro.' });
    }
    note = note.slice(0, 500);
    if (
      /\b(seed|mnemonic|recovery phrase|private key|xprv)\b/i.test(note) ||
      note.split(/\s+/).length >= 12
    ) {
      return res.status(400).json({
        error:
          'Do not enter seed phrases, mnemonics, or private keys. Notes are for short reminders only.',
      });
    }
  }

  const existing = database
    .prepare('SELECT * FROM progress WHERE user_id = ? AND step_id = ?')
    .get(req.session.userId, stepId);

  const nextNote =
    note !== undefined ? note : existing?.note != null ? existing.note : '';

  if (existing) {
    database
      .prepare(
        `UPDATE progress SET completed = ?, note = ?, updated_at = datetime('now')
         WHERE user_id = ? AND step_id = ?`
      )
      .run(completed ? 1 : 0, nextNote, req.session.userId, stepId);
  } else {
    database
      .prepare(
        `INSERT INTO progress (user_id, step_id, completed, note) VALUES (?, ?, ?, ?)`
      )
      .run(req.session.userId, stepId, completed ? 1 : 0, nextNote);
  }

  res.json({
    stepId,
    completed,
    note: nextNote,
  });
});

app.get('/api/billing/status', requireAuth, async (req, res) => {
  const database = await getDb();
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.json({
    plan: user.plan,
    stripeMode: hasStripe ? 'live-keys-or-test' : 'mock',
    priceDisplay: '$19/mo',
  });
});

app.post('/api/billing/checkout', requireAuth, async (req, res) => {
  const database = await getDb();
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

  if (!hasStripe || !stripe) {
    // Mock upgrade for portfolio demo when Stripe keys are absent
    database.prepare(`UPDATE users SET plan = 'pro' WHERE id = ?`).run(user.id);
    const updated = database.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    return res.json({
      mode: 'mock',
      message: 'Demo upgrade: plan set to Pro (no Stripe keys configured).',
      user: publicUser(updated),
    });
  }

  const sessionCheckout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email,
    client_reference_id: String(user.id),
    metadata: { userId: String(user.id) },
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${CLIENT_ORIGIN}/billing?success=1`,
    cancel_url: `${CLIENT_ORIGIN}/billing?canceled=1`,
  });
  res.json({ mode: 'stripe', url: sessionCheckout.url });
});

app.post('/api/billing/mock-downgrade', requireAuth, async (req, res) => {
  if (hasStripe) {
    return res.status(400).json({ error: 'Use Stripe Customer Portal when live.' });
  }
  const database = await getDb();
  database.prepare(`UPDATE users SET plan = 'free' WHERE id = ?`).run(req.session.userId);
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user: publicUser(user) });
});

// Serve built client in production if present
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const index = path.join(clientDist, 'index.html');
  res.sendFile(index, (err) => {
    if (err) next();
  });
});

async function main() {
  if (hasStripe) {
    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  await getDb();
  app.listen(PORT, () => {
    console.log(`CustodySteps API on http://localhost:${PORT}`);
    console.log(`Stripe: ${hasStripe ? 'configured' : 'mock upgrade mode'}`);
    console.log(`DB impl: ${getDbImpl()}`);
  });
}

main().catch((err) => {
  console.error('CustodySteps failed to start:', err);
  process.exit(1);
});
