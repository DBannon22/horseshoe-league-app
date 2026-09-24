import { useState, type ReactNode } from 'react';
import { useLeague } from '../state';
import { Name, NoSchedule, PageHeader, Progress } from '../components';
import { generateInWorker } from '../lib/generate';
import { randomSeed } from '../lib/rng';
import { formatDate, formatShortDate, todayIso } from '../lib/dates';
import { outcome, progress } from '../lib/standings';
import { hasScores } from '../lib/playoffs';
import { isRegular, type DoublesGame, type Game, type Phase, type Team, type Week } from '../lib/types';

const SECTIONS: { title: string; note: string; phases: Phase[] }[] = [
  { title: 'Weeks 1–7', note: 'A side stays on its court all night · B side rotates', phases: ['A_STAYS'] },
  { title: 'Weeks 8–14', note: 'B side stays on its court all night · A side rotates', phases: ['B_STAYS'] },
  { title: 'Playoffs', note: 'Week 15 doubles · Week 16 singles', phases: ['PLAYOFF_DOUBLES', 'PLAYOFF_SINGLES'] },
];

/** "player": one row per player (find your name). "court": one row per court. */
type View = 'player' | 'court';
const VIEW_KEY = 'horseshoe-schedule-view';

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'court' ? 'court' : 'player';
  } catch {
    return 'player';
  }
}

/** The next league night on or after today, if the season isn't over. */
function nextWeekNumber(weeks: Week[]): number | null {
  const today = todayIso();
  return weeks.find((w) => w.date >= today)?.number ?? null;
}

export function SchedulePage() {
  const { league, canEdit } = useLeague();
  const schedule = league.schedule;
  const [focus, setFocus] = useState('');
  const [view, setViewState] = useState<View>(loadView);
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Only a convenience; ignore storage failures.
    }
  };
  const next = schedule ? nextWeekNumber(schedule.weeks) : null;
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const open = next ?? schedule?.weeks.find((w) => w.games.some((g) => !outcome(g).complete))?.number;
    return new Set(open ? [open] : []);
  });

  const toggle = (n: number) =>
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(n)) s.delete(n);
      else s.add(n);
      return s;
    });

  const printAll = () => {
    if (!focus) setExpanded(new Set(schedule?.weeks.map((w) => w.number)));
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
        {!focus && (
          <>
            <button className="btn" onClick={() => setExpanded(new Set(schedule.weeks.map((w) => w.number)))}>
              Expand all
            </button>
            <button className="btn" onClick={() => setExpanded(new Set())}>
              Collapse all
            </button>
          </>
        )}
        <button className="btn" onClick={printAll}>
          Print
        </button>
      </PageHeader>

      <div className="card toolbar no-print">
        <label className="field">
          <span>Show schedule for</span>
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
        {!focus && (
          <div className="field">
            <span>Show weeks</span>
            <div className="segmented" role="group" aria-label="Show weeks">
              <button className={view === 'player' ? 'on' : undefined} onClick={() => setView('player')}>
                By player
              </button>
              <button className={view === 'court' ? 'on' : undefined} onClick={() => setView('court')}>
                By court
              </button>
            </div>
          </div>
        )}
        <span className="muted">
          Starts {formatDate(schedule.startDate)} · {schedule.gamesPerNight} game
          {schedule.gamesPerNight === 1 ? '' : 's'} per night
          {canEdit && ` · schedule #${schedule.seed}`}
        </span>
      </div>

      {focus ? (
        <PlayerSchedule id={focus} weeks={schedule.weeks} next={next} />
      ) : (
        SECTIONS.map((section) => (
          <div key={section.title} className="schedule-section">
            <div className="section-title">
              <h2>{section.title}</h2>
              <span className="muted small">{section.note}</span>
            </div>
            {schedule.weeks
              .filter((w) => section.phases.includes(w.phase))
              .map((week) => (
                <WeekCard
                  key={week.number}
                  week={week}
                  view={view}
                  next={week.number === next}
                  open={expanded.has(week.number)}
                  onToggle={() => toggle(week.number)}
                  onPick={(id) => {
                    setFocus(id);
                    window.scrollTo(0, 0);
                  }}
                />
              ))}
          </div>
        ))
      )}

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
  view,
  next,
  open,
  onToggle,
  onPick,
}: {
  week: Week;
  view: View;
  next: boolean;
  open: boolean;
  onToggle: () => void;
  onPick: (id: string) => void;
}) {
  const { canEdit } = useLeague();
  const p = progress(week.games);
  const linkLabel = canEdit && week.games.length > 0 ? 'Enter scores' : 'Open week';
  const kind = week.phase === 'PLAYOFF_DOUBLES' ? 'Doubles' : week.phase === 'PLAYOFF_SINGLES' ? 'Singles' : null;
  return (
    <article className={`card week${open ? ' open' : ''}${next ? ' next' : ''}`}>
      <header className="week-head">
        <button className="week-toggle" onClick={onToggle} aria-expanded={open}>
          <span className="chevron" aria-hidden="true">
            ›
          </span>
          <span className="week-num">Week {week.number}</span>
          <span className="week-date">{formatShortDate(week.date)}</span>
        </button>
        {next && <span className="tag next-tag">Next up</span>}
        {kind && <span className="tag">{kind}</span>}
        {p.total > 0 && p.done === p.total ? (
          <span className="progress complete">✓ Final</span>
        ) : (
          p.done > 0 && <Progress {...p} />
        )}
        <a className="btn small head-link" href={`#/week/${week.number}`}>
          {linkLabel}
        </a>
      </header>
      {open && (
        <div className="week-body">
          <a className="btn small body-link" href={`#/week/${week.number}`}>
            {linkLabel}
          </a>
          {week.games.length === 0 ? (
            <p className="muted">
              Matchups are set from the final regular-season standings — see <a href="#/playoffs">Playoffs</a>.
            </p>
          ) : view === 'player' ? (
            <PlayerGrid week={week} onPick={onPick} />
          ) : isRegular(week.phase) ? (
            <CourtTable week={week} />
          ) : (
            <MatchList week={week} />
          )}
        </div>
      )}
    </article>
  );
}

/**
 * One row per player, alphabetical, one column per game: which court they're
 * on and who their partner is. Built so anyone can find their own name and
 * read across. Clicking a name opens that player's full schedule.
 */
function PlayerGrid({ week, onPick }: { week: Week; onPick: (id: string) => void }) {
  const { league, player } = useLeague();
  const rounds = [...new Set(week.games.map((g) => g.round))].sort((x, y) => x - y);
  const singles = week.phase === 'PLAYOFF_SINGLES';
  const ids = league.players
    .filter((p) => week.games.some((g) => involves(g, p.id)))
    .sort((x, y) => x.name.localeCompare(y.name))
    .map((p) => p.id);

  const cell = (id: string, round: number) => {
    const g = week.games.find((x) => x.round === round && involves(x, id));
    if (!g) return null;
    const o = outcome(g);
    let mine: 0 | 1;
    let other: string;
    if (g.kind === 'doubles') {
      mine = g.teams[0].a === id || g.teams[0].b === id ? 0 : 1;
      const t = g.teams[mine];
      other = t.a === id ? t.b : t.a;
    } else {
      mine = g.players[0] === id ? 0 : 1;
      other = g.players[1 - mine];
    }
    const result = !o.complete ? null : o.winner === null ? 'T' : o.winner === mine ? 'W' : 'L';
    return { court: g.court, other, result };
  };

  return (
    <>
      <p className="grid-hint">
        Find your name, then read across: your <strong>court</strong> and{' '}
        <strong>{singles ? 'opponent' : 'partner'}</strong> for each {singles ? 'round' : 'game'}.
      </p>
      <table className="player-grid" style={{ ['--games' as string]: rounds.length }}>
        <thead>
          <tr>
            <th className="pg-name">Player</th>
            {rounds.map((r) => (
              <th key={r}>
                {singles ? 'Round' : 'Game'} {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => (
            <tr key={id}>
              <th className="pg-name">
                <button className="pg-player" onClick={() => onPick(id)} title="Show this player's whole season">
                  <Name id={id} />
                </button>
              </th>
              {rounds.map((r) => {
                const c = cell(id, r);
                return (
                  <td key={r} data-label={`${singles ? 'R' : 'G'}${r}`}>
                    {c ? (
                      <div className="pcell">
                        <span className="court-pill">Court {c.court}</span>
                        <span className="pc-other">
                          <span className="pc-with">{singles ? 'vs' : 'with'}</span> {player(c.other).name}
                        </span>
                        {c.result && <span className={`pc-result ${c.result}`}>{c.result}</span>}
                      </div>
                    ) : (
                      <span className="muted pc-off">Off</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/**
 * Regular-season night: each court keeps the same staying pair all night, so
 * show one row per court and one column per game with the rotating partners.
 * The first partner listed plays with the first staying player. Phones get a
 * stacked version (one block per court, one line per game) instead.
 */
function CourtTable({ week }: { week: Week }) {
  const staySide = week.phase === 'A_STAYS' ? 'A' : 'B';
  const rotateSide = staySide === 'A' ? 'B' : 'A';
  const games = week.games.filter((g): g is DoublesGame => g.kind === 'doubles');
  const rounds = [...new Set(games.map((g) => g.round))].sort((x, y) => x - y);
  const courts = [...new Set(games.map((g) => g.court))].sort((x, y) => x - y);
  const stayer = (t: Team) => (staySide === 'A' ? t.a : t.b);
  const rotator = (t: Team) => (staySide === 'A' ? t.b : t.a);

  const rows = courts.map((court) => {
    const row = games.filter((g) => g.court === court);
    const [first, second] = row[0].teams.map(stayer);
    const cells = rounds.map((round) => {
      const g = row.find((x) => x.round === round);
      if (!g) return { round, game: null };
      const i = stayer(g.teams[0]) === first ? 0 : 1;
      const o = outcome(g);
      return {
        round,
        game: {
          partners: [rotator(g.teams[i]), rotator(g.teams[1 - i])],
          won: [o.winner === i, o.winner === 1 - i],
          score: o.complete ? [o.totals[i], o.totals[1 - i]] : null,
        },
      };
    });
    return { court, first, second, cells };
  });

  return (
    <>
      <div className="table-wrap court-table-wrap">
        <table className="court-table">
          <thead>
            <tr>
              <th className="stay-col">Staying ({staySide} side)</th>
              {rounds.map((r) => (
                <th key={r}>
                  Game {r}
                  <span className="th-sub">{rotateSide} partners</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ court, first, second, cells }) => (
              <tr key={court}>
                <th className="stay-col">
                  <span className="court-label">Court {court}</span>
                  <div className="stack">
                    <Name id={first} />
                    <span className="vs">vs</span>
                    <Name id={second} />
                  </div>
                </th>
                {cells.map(({ round, game }) => (
                  <td key={round}>
                    {game && (
                      <div className="stack">
                        <span className={game.won[0] ? 'won' : undefined}>
                          <Name id={game.partners[0]} />
                        </span>
                        <span className="cell-score mono">{game.score && `${game.score[0]} – ${game.score[1]}`}</span>
                        <span className={game.won[1] ? 'won' : undefined}>
                          <Name id={game.partners[1]} />
                        </span>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="court-cards">
        {rows.map(({ court, first, second, cells }) => (
          <div key={court} className="court-card">
            <div className="court-card-head">
              <span className="court-label">Court {court}</span>
              <span className="court-card-pair">
                <Name id={first} />
                <span className="vs">vs</span>
                <Name id={second} />
              </span>
            </div>
            <table className="court-card-games">
              <tbody>
                {cells.map(
                  ({ round, game }) =>
                    game && (
                      <tr key={round}>
                        <th className="mono">G{round}</th>
                        <td className={game.won[0] ? 'won' : undefined}>
                          <Name id={game.partners[0]} />
                        </td>
                        <td className="mono cell-score">{game.score && `${game.score[0]}–${game.score[1]}`}</td>
                        <td className={game.won[1] ? 'won' : undefined}>
                          <Name id={game.partners[1]} />
                        </td>
                      </tr>
                    ),
                )}
              </tbody>
            </table>
          </div>
        ))}
        <p className="muted small">
          Each game: the left {rotateSide} partner plays with the first staying player, the right one with the second.
        </p>
      </div>
    </>
  );
}

/** Playoff nights: a plain list of matchups per game, with scores once entered. */
function MatchList({ week }: { week: Week }) {
  const label = week.phase === 'PLAYOFF_SINGLES' ? 'Round' : 'Game';
  return (
    <>
      {groupByRound(week.games).map(([round, games]) => (
        <div key={round} className="round">
          <div className="round-label">
            {label} {round}
          </div>
          <div className="match-list">
            {games.map((g) => {
              const o = outcome(g);
              const sides = g.kind === 'doubles' ? g.teams.map((t) => [t.a, t.b]) : g.players.map((p) => [p]);
              return (
                <div key={g.id} className="match">
                  <span className="court-label">
                    Court {g.court}
                    {g.kind === 'singles' && <span className="group-tag">{g.group.replace('-', ' ')}</span>}
                  </span>
                  {sides.map((ids, i) => (
                    <span key={i} className={`match-side side-${i}${o.winner === i ? ' won' : ''}`}>
                      {ids.map((id) => (
                        <Name key={id} id={id} />
                      ))}
                    </span>
                  ))}
                  <span className="match-score mono">{o.complete ? `${o.totals[0]} – ${o.totals[1]}` : 'vs'}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function PlayerSchedule({ id, weeks, next }: { id: string; weeks: Week[]; next: number | null }) {
  const { player } = useLeague();
  const name = (x: string) => player(x).name;
  const byWeek = weeks
    .map((week) => ({ week, games: week.games.filter((g) => involves(g, id)).sort((x, y) => x.round - y.round) }))
    .filter((w) => w.games.length > 0);

  return (
    <div className="card player-schedule">
      <h2>{player(id).name}</h2>
      <p className="muted small no-print">Every game this player is scheduled for. Print this page for a personal copy.</p>
      {byWeek.length === 0 && <p className="muted">No games yet.</p>}
      {byWeek.map(({ week, games }) => (
        <div key={week.number} className={`ps-week${week.number === next ? ' next' : ''}`}>
          <div className="ps-week-head">
            <strong>Week {week.number}</strong>
            <span className="muted">{formatDate(week.date)}</span>
            {week.number === next && <span className="tag next-tag">Next up</span>}
            <StayNote week={week} id={id} games={games} />
          </div>
          <div className="table-wrap">
            <table className="ps-table">
              <colgroup>
                <col className="ps-num" />
                <col className="ps-num" />
                <col />
                <col />
                <col className="ps-result" />
              </colgroup>
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Court</th>
                  <th>Partner</th>
                  <th>Opponents</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => {
                  const o = outcome(game);
                  let partner = '—';
                  let opponents: string;
                  let mine: number;
                  if (game.kind === 'doubles') {
                    mine = game.teams.findIndex((t) => t.a === id || t.b === id);
                    const t = game.teams[mine];
                    const opp = game.teams[1 - mine];
                    partner = name(t.a === id ? t.b : t.a);
                    opponents = `${name(opp.a)} & ${name(opp.b)}`;
                  } else {
                    mine = game.players[0] === id ? 0 : 1;
                    opponents = name(game.players[1 - mine]);
                  }
                  const result = !o.complete
                    ? ''
                    : `${o.winner === null ? 'T' : o.winner === mine ? 'W' : 'L'} ${o.totals[mine]}–${o.totals[1 - mine]}`;
                  return (
                    <tr key={game.id}>
                      <td className="mono">{game.round}</td>
                      <td className="mono">{game.court}</td>
                      <td>{partner}</td>
                      <td>{opponents}</td>
                      <td className={`mono result ${result[0] ?? ''}`}>{result}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Stays on court 2" when this player is on the staying side that night. */
function StayNote({ week, id, games }: { week: Week; id: string; games: Game[] }): ReactNode {
  const { player } = useLeague();
  const side = player(id).side;
  const stays = (week.phase === 'A_STAYS' && side === 'A') || (week.phase === 'B_STAYS' && side === 'B');
  if (!stays || games.length === 0) return null;
  return <span className="tag">Stays on court {games[0].court}</span>;
}

function involves(g: Game, id: string): boolean {
  return g.kind === 'doubles' ? g.teams.some((t) => t.a === id || t.b === id) : g.players.includes(id);
}

export function groupByRound(games: Game[]): [number, Game[]][] {
  const map = new Map<number, Game[]>();
  for (const g of games) map.set(g.round, [...(map.get(g.round) ?? []), g]);
  return [...map.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([r, gs]) => [r, gs.sort((x, y) => x.court - y.court)]);
}
