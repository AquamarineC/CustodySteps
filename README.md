# CustodySteps

**Educational Bitcoin self-custody literacy checklist** — a small Micro SaaS MVP shaped like a real product a hiring manager can skim in five minutes.

> **Not a wallet.** No keys, balances, xpubs, price APIs, or seed inputs. Educational tool only — not investment, legal, or tax advice.

---

## Why this exists (portfolio + product)

New Bitcoiners know self-custody matters but stall on *what to do in what order*. CustodySteps turns scattered advice into a calm checklist with plain-language explainers and progress tracking.

| Job | Signal |
| --- | --- |
| Junior FE / full-stack portfolio | Vite + React Router, auth-gated routes, CRUD-ish progress, billing gate |
| Micro SaaS shape | Free vs Pro ($19/mo), Stripe Checkout when keys exist, honest mock otherwise |

---

## Stack

| Layer | Choice |
| --- | --- |
| Client | Vite, React 18, React Router |
| Server | Express, express-session, bcryptjs |
| DB | SQLite via **better-sqlite3**, with **sql.js** fallback if native build fails |
| Payments | Optional Stripe Checkout; **mock `plan=pro`** when env keys are absent |

Layout:

```
custodysteps/
  client/          # Vite React SPA
  server/          # Express API + SQLite
  README.md
  .env.example
  package.json     # convenience scripts
```

---

## Features (MVP)

- `/` — Landing with disclaimers + CTA  
- `/signup`, `/login` — email/password (session cookie)  
- `/app` — auth-gated checklist (~10 literacy steps); Free = first 5; Pro unlocks all + short notes; progress %  
- `/billing` — Free vs Pro $19/mo; Stripe Checkout if `STRIPE_*` set, else one-click mock upgrade  

**Hard product rules:** never accept seed phrases; reject note payloads that look like mnemonics; no wallet/balance/price code.

---

## How to run (local)

Requires Node 18+.

```bash
cd /workspace/micro-saas/custodysteps

# Install (root helpers + server + client)
npm install
npm run install:all

# Optional: copy env
cp .env.example server/.env

# Terminal A — API (default http://localhost:3001)
npm run dev:server

# Terminal B — Vite (http://localhost:5173, proxies /api → 3001)
npm run dev:client
```

Or from root after `npm install` (root) + `install:all`:

```bash
npm run dev   # concurrently server + client (needs root concurrently)
```

**Production-ish smoke:**

```bash
npm run build                 # builds client → client/dist
# server serves client/dist when present
npm start --prefix server
```

**API smoke script** (server must be up):

```bash
npm run smoke --prefix server
# or: node server/scripts/smoke-flow.js
```

---

## Environment

See `.env.example`. Put secrets in `server/.env` (never commit):

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (3001) |
| `SESSION_SECRET` | Session signing |
| `CLIENT_ORIGIN` | CORS origin (`http://localhost:5173`) |
| `DATABASE_PATH` | SQLite file path |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` | Enable real Checkout |
| `STRIPE_WEBHOOK_SECRET` | Webhook → set `plan=pro` |

If Stripe keys are blank, **POST `/api/billing/checkout`** sets `plan=pro` immediately (demo mode). Documented honestly for portfolio reviewers.

---

## Literacy steps (seeded)

1. Password manager for **accounts** (not seeds)  
2. Offline seed backup **concepts** + never type seeds here  
3. Verify receive address on device  
4. Phishing hygiene  
5. 2FA on exchanges before exit  
6. Hardware wallet research *(Pro)*  
7. Small test receive practice *(Pro)*  
8. Inheritance awareness — not legal advice *(Pro)*  
9. Monthly review *(Pro)*  
10. Social engineering red flags *(Pro)*  

---

## API sketch

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | db impl + stripe mode |
| GET | `/api/steps` | static literacy library |
| POST | `/api/auth/signup` \| `/login` \| `/logout` | session |
| GET | `/api/auth/me` | current user |
| GET/PUT | `/api/progress` / `/api/progress/:stepId` | checks + Pro notes |
| POST | `/api/billing/checkout` | Stripe URL or mock Pro |

---

## What’s unfinished (honest)

- No Hostinger deploy in this phase (box-only MVP)  
- Stripe Customer Portal / cancel flow not wired until live keys + webhook URL  
- No email verification / password reset  
- Session store is in-memory MemoryStore (fine for demo; swap for production)  
- UI is calm and blunt, not polished design-system work  

---

## Hiring-manager tour (5 minutes)

1. Read this README + open `/` disclaimers  
2. Sign up → check a Free step → refresh → still checked  
3. Open `/billing` → **Mock upgrade to Pro** → locked steps unlock + notes  
4. Skim `server/src/index.js` + `client/src/pages/AppChecklist.jsx`  

Built for AquamarinA / AquamarineC portfolio narrative (Quiet Stack–adjacent education, not trading tools).

---

## License

Private / portfolio demo unless otherwise stated. Educational content only.
