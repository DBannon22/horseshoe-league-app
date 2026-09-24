import { useState, type FormEvent } from 'react';
import { useLeague } from '../state';
import { PageHeader } from '../components';

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Couldn’t reach the server. Check your internet connection.',
};

export function LoginPage() {
  const { cloudEnabled, user, isAdmin, authReady, signIn, signOut } = useLeague();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!cloudEnabled)
    return (
      <section className="narrow">
        <PageHeader title="Admin login" />
        <div className="card">
          <p>
            Login isn’t set up yet, so this copy of the app is in local mode: anyone using this browser can edit, and
            nobody else can see the data. See “Admin login setup” in the README to connect it to Firebase.
          </p>
        </div>
      </section>
    );

  if (!authReady) return <p className="muted">Checking sign-in…</p>;

  if (user)
    return (
      <section className="narrow">
        <PageHeader title={isAdmin ? 'Admin' : 'Account'} />
        <div className="card">
          <p>
            Signed in as <strong>{user.email}</strong>.
          </p>
          {isAdmin ? (
            <p>You can enter scores, manage the schedule and roster, and seed the playoffs.</p>
          ) : (
            <p>
              You can view the schedule, scores, standings and roster. To enter scores, sign out and sign in with the
              admin account.
            </p>
          )}
          <div className="form-row">
            <a className="btn primary" href="#/schedule">
              Go to schedule
            </a>
            <button className="btn" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </section>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
      window.location.hash = '#/schedule';
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(MESSAGES[code] ?? 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="narrow">
      <PageHeader title="Sign in" />
      <form className="card form-stack login" onSubmit={submit}>
        <p className="muted">
          The league site is for members only. Sign in with the league email and password — ask the league admin if
          you don’t have them. You’ll stay signed in on this device.
        </p>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}
