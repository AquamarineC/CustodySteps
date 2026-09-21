import { Link } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="landing">
      <section className="hero">
        <p className="eyebrow">Educational checklist · not a wallet</p>
        <h1>Turn “I should secure my Bitcoin” into calm, trackable steps.</h1>
        <p className="lede">
          CustodySteps is a beginner-friendly literacy checklist for self-custody hygiene —
          plain-language explainers, progress tracking, and blunt disclaimers. No keys. No
          balances. No price charts.
        </p>
        <div className="cta-row">
          {user ? (
            <Link to="/app" className="btn primary">
              Open checklist
            </Link>
          ) : (
            <>
              <Link to="/signup" className="btn primary">
                Start free
              </Link>
              <Link to="/login" className="btn ghost">
                Log in
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Who it’s for</h2>
          <ul>
            <li>Bitcoin beginners ready to practice hygiene, not trade</li>
            <li>DIY learners who want order instead of scattered threads</li>
            <li>Anyone who wants a monthly review habit — calmly</li>
          </ul>
        </div>
        <div className="card warn">
          <h2>What this is not</h2>
          <ul>
            <li>Not a wallet, custodian, or money transmitter</li>
            <li>Not investment, legal, or tax advice</li>
            <li>Never asks for seed phrases — and has no field for them</li>
            <li>No balances, xpubs, or price API calls</li>
          </ul>
        </div>
      </section>

      <section className="card">
        <h2>Free vs Pro</h2>
        <p>
          <strong>Free:</strong> account + first 5 literacy steps + progress %.
        </p>
        <p>
          <strong>Pro ($19/mo):</strong> full checklist (10 steps), short notes per step, monthly
          review focus.
        </p>
        <Link to={user ? '/billing' : '/signup'} className="btn small">
          See billing
        </Link>
      </section>

      <aside className="disclaimer">
        <strong>Disclaimers:</strong> CustodySteps is an educational product only. It does not
        store or transmit cryptocurrency. Do not type recovery phrases, private keys, or mnemonics
        into this application — or any unexpected website. If someone asks you to “verify” a seed
        here, that is a scam; this product will never request one.
      </aside>
    </div>
  );
}
