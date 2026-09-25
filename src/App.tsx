import { useEffect } from 'react';
import { useHashRoute, useLeague } from './state';
import { SchedulePage } from './pages/SchedulePage';
import { WeekPage } from './pages/WeekPage';
import { StandingsPage } from './pages/StandingsPage';
import { PlayoffsPage } from './pages/PlayoffsPage';
import { RosterPage } from './pages/RosterPage';
import { SettingsPage } from './pages/SettingsPage';
import { RulesPage } from './pages/RulesPage';
import { LoginPage } from './pages/LoginPage';
import { SetupLeague } from './pages/SetupLeague';
import { AdminOnly } from './components';

const NAV = [
  { path: 'schedule', label: 'Schedule' },
  { path: 'standings', label: 'Standings' },
  { path: 'playoffs', label: 'Playoffs' },
  { path: 'roster', label: 'Roster' },
  { path: 'rules', label: 'Rules' },
  { path: 'settings', label: 'Settings', adminOnly: true },
];

export default function App() {
  const { league, status, canEdit, cloudEnabled, user, saveState, error, signOut } = useLeague();
  const signedOut = status === 'signed-out';
  const [page = 'schedule', arg] = useHashRoute();
  const active = page === 'week' ? 'schedule' : page;

  useEffect(() => {
    document.title = league.settings.leagueName || 'Horseshoe League';
  }, [league.settings.leagueName]);

  let content;
  if (signedOut || page === 'login') content = <LoginPage />;
  else if (status === 'denied')
    content = (
      <div className="card empty">
        <p>
          You’re signed in as <strong>{user?.email}</strong>, but this account hasn’t been given access to the league.
          Ask the league admin, or sign in with the league login.
        </p>
        <button className="btn primary" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    );
  else if (status === 'loading') content = <p className="muted">Loading league…</p>;
  else if (status === 'error')
    content = (
      <div className="card empty">
        <p className="error">Couldn’t load the league: {error}</p>
      </div>
    );
  else if (status === 'missing') content = <SetupLeague />;
  else
    switch (page) {
      case 'week':
        content = <WeekPage number={Number(arg)} />;
        break;
      case 'standings':
        content = <StandingsPage />;
        break;
      case 'playoffs':
        content = <PlayoffsPage />;
        break;
      case 'roster':
        content = <RosterPage />;
        break;
      case 'rules':
        content = <RulesPage />;
        break;
      case 'settings':
        content = canEdit ? <SettingsPage /> : <AdminOnly />;
        break;
      default:
        content = <SchedulePage />;
    }

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#/schedule">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M8 28V14a8 8 0 0 1 16 0v14" />
            </svg>
            <span>{league.settings.leagueName}</span>
          </a>
          {!signedOut && (
            <nav>
              {NAV.filter((n) => canEdit || !n.adminOnly).map((n) => (
                <a key={n.path} href={`#/${n.path}`} className={active === n.path ? 'active' : undefined}>
                  {n.label}
                </a>
              ))}
            </nav>
          )}
          {cloudEnabled && !signedOut && (
            <div className="account">
              {canEdit && (
                <span className={`save-state ${saveState}`} title={saveState === 'error' ? error : undefined}>
                  {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : 'Saved'}
                </span>
              )}
              <a href="#/login" className={`account-link${active === 'login' ? ' active' : ''}`}>
                {user ? (canEdit ? 'Admin' : 'Account') : 'Sign in'}
              </a>
            </div>
          )}
        </div>
      </header>
      {saveState === 'error' && canEdit && (
        <div className="banner error-banner">
          Your last change wasn’t saved: {error}. Check your connection and make the change again.
        </div>
      )}
      <main>{content}</main>
    </>
  );
}
