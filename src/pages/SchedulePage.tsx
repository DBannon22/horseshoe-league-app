import { useMemo, useState } from 'react';
import { useLeague } from '../state';
import { Name, NoSchedule, PageHeader, PhaseBadge, Progress } from '../components';
import { generateInWorker } from '../lib/generate';
import { randomSeed } from '../lib/rng';
import { formatDate, todayIso } from '../lib/dates';
import { outcome, progress } from '../lib/standings';
import { hasScores } from '../lib/playoffs';
import { isRegular, type Game, type Week } from '../lib/types';

export function SchedulePage() {
  const { league, canEdit } = useLeague();
  const schedule = league.schedule;
  const [focus, setFocus] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const next = schedule?.weeks.find((w) => w.games.some((g) => !outcome(g).complete));
    return new Set(next ? [next.number] : []);
  });

  const toggle = (n: number) =>
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(n)) s.delete(n);
      else s.add(n);
      return s;
    });

  const printAll = () => {
    setExpanded(new Set(schedule?.weeks.map((w) => w.number)));
    setTimeout(() => window.print(), 50);
  };

  if (!schedule)
    return (
      <section>
        <PageHeader title="Schedule" />
        {canEdit ? <Generator /> : <NoSchedule />}
      </section>
    );

  return (
    <section>
      <PageHeader title="Schedule">
        <button className="btn" onClick={() => setExpanded(new Set(schedule.weeks.map((w) => w.number)))}>
          Expand all
        </button>
        <button className="btn" onClick={() => setExpanded(new Set())}>
          Collapse all
        </button>
        <button className="btn" onClick={printAll}>
          Print
        </button>
      </PageHeader>

      <div className="card toolbar no-print">
        <label className="field">
          <span>Show one player's schedule</span>
          <select value={focus} onChange={(e) => setFocus(e.target.value)}>
            <option value="">Everyone</option>
            {(['A', 'B'] as const).map((side) => (
              <optgroup key={side} label={`${side} side`}>
                {league.players
                  .filter((p) => p.side === side)
                  .sort((x, y) => x.slot - y.slot)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <span className="muted">
          Starts {formatDate(schedule.startDate)} · {schedule.gamesPerNight} game
          {schedule.gamesPerNight === 1 ? '' : 's'} per night · schedule #{schedule.seed}
        </span>
      </div>

      {focus && <PlayerSchedule id={focus} weeks={schedule.weeks} />}

      <div className="weeks">
        {schedule.weeks.map((week) => (
          <WeekCard
            key={week.number}
            week={week}
            open={expanded.has(week.number)}
            onToggle={() => toggle(week.number)}
            focus={focus}
          />
        ))}
      </div>

      {canEdit && (
        <details className="card regenerate no-print">
          <summary>Regenerate or change start date</summary>
          <Generator />
        </details>
      )}
    </section>
  );
}

function Generator() {
  const { league, update } = useLeague();
  const existing = league.schedule;
  const [startDate, setStartDate] = useState(existing?.startDate ?? todayIso());
  const [games, setGames] = useState(existing?.gamesPerNight ?? league.settings.gamesPerNight);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const scored = existing?.weeks.some(hasScores) ?? false;

  const run = async () => {
    if (!startDate) return setError('Pick a start date.');
    if (
      existing &&
      !window.confirm(
        scored
          ? 'This replaces the current schedule and DELETES every score entered so far. Continue?'
          : 'Replace the current schedule with a new one?',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      const schedule = await generateInWorker({
        players: league.players,
        startDate,
        gamesPerNight: games,
        seed: randomSeed(),
      });
      update((l) => {
        l.schedule = schedule;
        l.settings.gamesPerNight = games;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card generator">
      {!existing && (
        <p>
          Builds all 16 weeks: weeks 1–7 the A side stays on its court while the B side rotates, weeks 8–14 the B
          side stays while the A side rotates, then playoff doubles (week 15) and singles (week 16). Matchups are
          balanced so everyone partners with and plays against everyone as evenly as possible. Enter your{' '}
          <a href="#/roster">roster</a> first or rename players any time later.
        </p>
      )}
      <div className="form-row">
        <label className="field">
          <span>First league night</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Games per night</span>
          <select value={games} onChange={(e) => setGames(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
                {n === 4 ? ' (each rotating player visits every court)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button className="btn primary" onClick={run} disabled={busy}>
          {busy ? 'Balancing matchups…' : existing ? 'Regenerate schedule' : 'Generate schedule'}
        </button>
      </div>
      {existing && (
        <p className="muted small">
          To move one night (rain-out, holiday) without losing scores, open that week and use “Push back a week”.
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function WeekCard({
  week,
  open,
  onToggle,
  focus,
}: {
  week: Week;
  open: boolean;
  onToggle: () => void;
  focus: string;
}) {
  const { canEdit } = useLeague();
  const p = progress(week.games);
  return (
    <article className={`card week${open ? ' open' : ''}`}>
      <header className="week-head">
        <button className="week-toggle" onClick={onToggle} aria-expanded={open}>
          <span className="chevron" aria-hidden="true">
            ›
          </span>
          <span className="week-num">Week {week.number}</span>
          <span className="week-date">{formatDate(week.date)}</span>
        </button>
        <PhaseBadge phase={week.phase} />
        <Progress {...p} />
        <a className="btn small" href={`#/week/${week.number}`}>
          {canEdit && (isRegular(week.phase) || week.games.length) ? 'Enter scores' : 'View'}
        </a>
      </header>
      {open && <WeekMatchups week={week} focus={focus} />}
    </article>
  );
}

export function WeekMatchups({ week, focus }: { week: Week; focus: string }) {
  const rounds = useMemo(() => groupByRound(week.games), [week.games]);
  if (week.games.length === 0)
    return (
      <p className="muted week-body">
        Matchups are set from the final regular-season standings — see <a href="#/playoffs">Playoffs</a>.
      </p>
    );
  return (
    <div className="week-body">
      {rounds.map(([round, games]) => (
        <div key={round} className="round">
          <div className="round-label">{week.phase === 'PLAYOFF_SINGLES' ? `Round ${round}` : `Game ${round}`}</div>
          <div className="courts">
            {games.map((g) => (
              <div key={g.id} className={`matchup${focus && involves(g, focus) ? ' focus' : ''}`}>
                <div className="court-label">
                  Court {g.court}
                  {g.kind === 'singles' && <span className="group-tag">{g.group}</span>}
                </div>
                {g.kind === 'doubles' ? (
                  <>
                    <div className="team">
                      <Name id={g.teams[0].a} mark={focus} />
                      <Name id={g.teams[0].b} mark={focus} />
                    </div>
                    <div className="vs">vs</div>
                    <div className="team">
                      <Name id={g.teams[1].a} mark={focus} />
                      <Name id={g.teams[1].b} mark={focus} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="team">
                      <Name id={g.players[0]} mark={focus} />
                    </div>
                    <div className="vs">vs</div>
                    <div className="team">
                      <Name id={g.players[1]} mark={focus} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlayerSchedule({ id, weeks }: { id: string; weeks: Week[] }) {
  const { player } = useLeague();
  const rows = weeks.flatMap((week) =>
    week.games.filter((g) => involves(g, id)).map((g) => ({ week, game: g })),
  );
  const name = (x: string) => player(x).name;
  return (
    <div className="card player-schedule">
      <h2>{player(id).name}’s schedule</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Date</th>
              <th>Game</th>
              <th>Court</th>
              <th>Partner</th>
              <th>Opponents</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ week, game }) => {
              let partner = '—';
              let opponents: string;
              if (game.kind === 'doubles') {
                const mine = game.teams.findIndex((t) => t.a === id || t.b === id);
                const t = game.teams[mine];
                const o = game.teams[1 - mine];
                partner = name(t.a === id ? t.b : t.a);
                opponents = `${name(o.a)} & ${name(o.b)}`;
              } else {
                opponents = name(game.players[0] === id ? game.players[1] : game.players[0]);
              }
              return (
                <tr key={game.id}>
                  <td className="mono">{week.number}</td>
                  <td className="mono">{week.date}</td>
                  <td className="mono">{game.round}</td>
                  <td className="mono">{game.court}</td>
                  <td>{partner}</td>
                  <td>{opponents}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="muted">No games yet.</p>}
    </div>
  );
}

function involves(g: Game, id: string): boolean {
  return g.kind === 'doubles'
    ? g.teams.some((t) => t.a === id || t.b === id)
    : g.players.includes(id);
}

export function groupByRound(games: Game[]): [number, Game[]][] {
  const map = new Map<number, Game[]>();
  for (const g of games) map.set(g.round, [...(map.get(g.round) ?? []), g]);
  return [...map.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([r, gs]) => [r, gs.sort((x, y) => x.court - y.court)]);
}
