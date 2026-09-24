import { useLeague } from '../state';
import { NoSchedule, PageHeader, Progress } from '../components';
import { StatsTable } from './StandingsPage';
import {
  doublesStandings,
  hasScores,
  SINGLES_GROUPS,
  seedPlayoffs,
  singlesGroupIds,
} from '../lib/playoffs';
import { average, playerStats, progress, rank, regularGames } from '../lib/standings';
import { SIDE_SIZE } from '../lib/types';

export function PlayoffsPage() {
  const { league, update, player, canEdit } = useLeague();
  const schedule = league.schedule;
  if (!schedule) return <NoSchedule />;

  const seeding = schedule.playoffSeeding;
  const doublesWeek = schedule.weeks.find((w) => w.phase === 'PLAYOFF_DOUBLES')!;
  const singlesWeek = schedule.weeks.find((w) => w.phase === 'PLAYOFF_SINGLES')!;
  const regular = progress(regularGames(schedule.weeks));

  const seed = () => {
    const warnings: string[] = [];
    if (regular.done < regular.total)
      warnings.push(`Only ${regular.done} of ${regular.total} regular-season games are scored.`);
    if (hasScores(doublesWeek) || hasScores(singlesWeek))
      warnings.push('Playoff scores already entered will be deleted.');
    if (warnings.length && !window.confirm(`${warnings.join('\n')}\n\nSeed playoffs from current standings?`)) return;
    const next = seedPlayoffs(league);
    update((l) => {
      l.schedule = next;
    });
  };

  return (
    <section>
      <PageHeader title="Playoffs">
        {canEdit && (
          <button className={`btn${seeding ? '' : ' primary'}`} onClick={seed}>
            {seeding ? 'Re-seed from standings' : 'Seed playoffs from standings'}
          </button>
        )}
      </PageHeader>
      <p className="muted">
        Seeds come from the regular-season standings (weeks 1–14). Regular season: <Progress {...regular} />.
        {seeding && ` Seeded ${new Date(seeding.seededAt).toLocaleString()}.`}
      </p>

      {!seeding ? (
        <div className="card empty">
          <p>
            {canEdit ? 'Once the regular season is finished, seed the playoffs.' : 'Playoff matchups will be posted after the regular season.'}{' '}
            Week {doublesWeek.number} is doubles (A1 + B8, A2 +
            B7 … A8 + B1); week {singlesWeek.number} is singles with the top four and bottom four of each side playing
            within their group.
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="section-head">
              <h2>Week {doublesWeek.number} · Doubles</h2>
              <Progress {...progress(doublesWeek.games)} />
              <a className="btn small" href={`#/week/${doublesWeek.number}`}>
                {canEdit ? 'Enter scores' : 'View games'}
              </a>
            </div>
            <div className="table-wrap">
              <table className="stats">
                <thead>
                  <tr>
                    <th>#</th>
                    <th className="left">Team</th>
                    <th>Seeds</th>
                    <th>GP</th>
                    <th>W-L-T</th>
                    <th>Pts</th>
                    <th>Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {doublesStandings(league).map((row, i) => (
                    <tr key={row.id}>
                      <td className="mono rank">{i + 1}</td>
                      <td className="left">
                        {player(row.team.a).name} &amp; {player(row.team.b).name}
                      </td>
                      <td className="mono">
                        A{row.seed} + B{SIDE_SIZE + 1 - row.seed}
                      </td>
                      <td className="mono">{row.gp}</td>
                      <td className="mono">
                        {row.w}-{row.l}-{row.t}
                      </td>
                      <td className="mono strong">{row.pts}</td>
                      <td className="mono">{average(row).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="section-head">
              <h2>Week {singlesWeek.number} · Singles</h2>
              <Progress {...progress(singlesWeek.games)} />
              <a className="btn small" href={`#/week/${singlesWeek.number}`}>
                {canEdit ? 'Enter scores' : 'View games'}
              </a>
            </div>
            <div className="two-col">
              {SINGLES_GROUPS.map((group) => {
                const ids = singlesGroupIds(seeding, group);
                const games = singlesWeek.games.filter((g) => g.kind === 'singles' && g.group === group);
                return (
                  <div key={group} className="group">
                    <h3>
                      {group.replace('-', ' ')} <span className="muted small">(seeds {seedRange(group)})</span>
                    </h3>
                    <StatsTable rows={rank(playerStats(games, ids), league.settings.rankBy)} />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function seedRange(group: string): string {
  const side = group[0];
  const half = SIDE_SIZE / 2;
  return group.endsWith('Top') ? `${side}1–${side}${half}` : `${side}${half + 1}–${side}${SIDE_SIZE}`;
}
