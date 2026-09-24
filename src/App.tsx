import { useEffect } from 'react';
import { useHashRoute, useLeague } from './state';
import { SchedulePage } from './pages/SchedulePage';
import { WeekPage } from './pages/WeekPage';
import { StandingsPage } from './pages/StandingsPage';
import { PlayoffsPage } from './pages/PlayoffsPage';
import { RosterPage } from './pages/RosterPage';
import { SettingsPage } from './pages/SettingsPage';

const NAV = [
  { path: 'schedule', label: 'Schedule' },
  { path: 'standings', label: 'Standings' },
  { path: 'playoffs', label: 'Playoffs' },
  { path: 'roster', label: 'Roster' },
  { path: 'settings', label: 'Settings' },
];

export default function App() {
  const { league } = useLeague();
  const [page = 'schedule', arg] = useHashRoute();
  const active = page === 'week' ? 'schedule' : page;

  useEffect(() => {
    document.title = league.settings.leagueName || 'Horseshoe League';
  }, [league.settings.leagueName]);

  let content;
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
    case 'settings':
      content = <SettingsPage />;
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
          <nav>
            {NAV.map((n) => (
              <a key={n.path} href={`#/${n.path}`} className={active === n.path ? 'active' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main>{content}</main>
    </>
  );
}
