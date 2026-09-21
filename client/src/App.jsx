import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Login from './pages/Login';
import AppChecklist from './pages/AppChecklist';
import Billing from './pages/Billing';

function Nav() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  return (
    <header className="nav">
      <Link to="/" className="brand">
        CustodySteps
      </Link>
      <nav className="nav-links">
        {user ? (
          <>
            <Link to="/app" className={loc.pathname === '/app' ? 'active' : ''}>
              Checklist
            </Link>
            <Link to="/billing" className={loc.pathname === '/billing' ? 'active' : ''}>
              Billing
            </Link>
            <span className="plan-pill">{user.plan === 'pro' ? 'Pro' : 'Free'}</span>
            <button type="button" className="btn ghost" onClick={() => logout()}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/signup" className="btn small">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted center pad">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="shell">
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/app"
            element={
              <Protected>
                <AppChecklist />
              </Protected>
            }
          />
          <Route
            path="/billing"
            element={
              <Protected>
                <Billing />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>
          Educational tool only. Not investment, legal, or tax advice. Never enter seed phrases
          here — there is no input for them.
        </p>
      </footer>
    </div>
  );
}
