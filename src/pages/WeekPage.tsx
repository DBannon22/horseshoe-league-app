import { useLeague } from '../state';
import { Name, NoSchedule, PageHeader, PhaseBadge, Progress } from '../components';
import { groupByRound } from './SchedulePage';
import { addDays, formatDate } from '../lib/dates';
import { outcome, progress } from '../lib/standings';
import { TOTAL_WEEKS, type Game } from '../lib/types';

const PHASE_HELP = {
  A_STAYS: 'Each A pair stays on its court all night. B players move to a new court each game.',
  B_STAYS: 'Each B pair stays on its court all night. A players move to a new court each game.',
  PLAYOFF_DOUBLES: 'Seeded teams: A1 + B8, A2 + B7 … A8 + B1. Enter one score per team.',
  PLAYOFF_SINGLES: 'Top four and bottom four of each side play a round robin within their group.',
};

export function WeekPage({ number }: { number: number }) {
  const { league, update, canEdit } = useLeague();
  const schedule = league.schedule;
  if (!schedule) return <NoSchedule />;
  const week = schedule.weeks.find((w) => w.number === number);
  if (!week) return <p>Week not found.</p>;

  const setDate = (date: string) =>
    date &&
    update((l) => {
      l.schedule!.weeks[number - 1].date = date;
    });

  const pushBack = () => {
    if (!window.confirm(`Move week ${number} and every week after it back 7 days?`)) return;
    update((l) => {
      for (const w of l.schedule!.weeks) if (w.number >= number) w.date = addDays(w.date, 7);
    });
  };

  return (
    <section>
      <PageHeader title={`Week ${number}`}>
        {number > 1 && (
          <a className="btn" href={`#/week/${number - 1}`}>
            ‹ Week {number - 1}
          </a>
        )}
        {number < TOTAL_WEEKS && (
          <a className="btn" href={`#/week/${number + 1}`}>
            Week {number + 1} ›
          </a>
        )}
      </PageHeader>

      <div className="card week-meta">
        <div className="form-row">
          {canEdit ? (
            <>
              <label className="field">
                <span>Date</span>
                <input type="date" value={week.date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <button className="btn" onClick={pushBack}>
                Push back a week
              </button>
            </>
          ) : (
            <h2 className="week-date-title">{formatDate(week.date)}</h2>
          )}
          <div className="meta-info">
            <PhaseBadge phase={week.phase} />
            <Progress {...progress(week.games)} />
          </div>
        </div>
        <p className="muted small">
          {canEdit && `${formatDate(week.date)} · `}
          {PHASE_HELP[week.phase]}
        </p>
      </div>

      {week.games.length === 0 ? (
        <div className="card empty">
          <p>Playoff matchups are set from the final regular-season standings.</p>
          {canEdit && (
            <a className="btn primary" href="#/playoffs">
              Go to Playoffs
            </a>
          )}
        </div>
      ) : (
        groupByRound(week.games).map(([round, games]) => (
          <div key={round} className="score-round">
            <h2>{week.phase === 'PLAYOFF_SINGLES' ? `Round ${round}` : `Game ${round}`}</h2>
            <div className="score-grid">
              {games.map((g) => (
                <GameCard key={g.id} game={g} weekIndex={number - 1} />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function GameCard({ game, weekIndex }: { game: Game; weekIndex: number }) {
  const { update, canEdit } = useLeague();
  const o = outcome(game);

  const setScore = (side: 0 | 1, raw: string) =>
    update((l) => {
      const g = l.schedule!.weeks[weekIndex].games.find((x) => x.id === game.id)!;
      const n = Number(raw);
      g.score[side] = raw.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n);
    });

  const sides = game.kind === 'doubles' ? game.teams.map((t) => [t.a, t.b]) : game.players.map((p) => [p]);

  return (
    <div className="card game-card">
      <div className="game-head">
        <span className="court-label">Court {game.court}</span>
        {game.kind === 'singles' && <span className="group-tag">{game.group}</span>}
        {o.complete && o.winner === null && <span className="badge tie">Tie</span>}
      </div>
      {sides.map((ids, i) => {
        const side = i as 0 | 1;
        const won = o.complete && o.winner === side;
        const lost = o.complete && o.winner === 1 - side;
        return (
          <label key={i} className={`score-side${won ? ' won' : ''}${lost ? ' lost' : ''}`}>
            <div className="score-players">
              {ids.map((id) => (
                <Name key={id} id={id} />
              ))}
            </div>
            {canEdit ? (
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="score-input mono"
                value={game.score[side] ?? ''}
                onChange={(e) => setScore(side, e.target.value)}
                aria-label={ids.length > 1 ? 'Team score' : 'Score'}
              />
            ) : (
              <span className="score-value mono">{game.score[side] ?? '–'}</span>
            )}
            <div className="score-result">
              {won && <span className="badge win">W</span>}
              {lost && <span className="badge loss">L</span>}
            </div>
          </label>
        );
      })}
    </div>
  );
}
