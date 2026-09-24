import { useLeague } from '../state';
import { NoSchedule, PageHeader, Progress } from '../components';
import { average, progress, RANK_LABEL, regularGames, sideStandings, type Stats } from '../lib/standings';

export function StandingsPage() {
  const { league } = useLeague();
  if (!league.schedule) return <NoSchedule />;
  const p = progress(regularGames(league.schedule.weeks));
  return (
    <section>
      <PageHeader title="Standings" />
      <p className="muted">
        Regular season (weeks 1–14) · ranked by <strong>{RANK_LABEL[league.settings.rankBy]}</strong> (change in{' '}
        <a href="#/settings">Settings</a>) · <Progress {...p} />
      </p>
      <div className="two-col">
        {(['A', 'B'] as const).map((side) => (
          <div key={side} className="card">
            <h2>{side} side</h2>
            <StatsTable rows={sideStandings(league, side)} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function StatsTable({ rows, seedLabel = '#' }: { rows: Stats[]; seedLabel?: string }) {
  const { player } = useLeague();
  return (
    <div className="table-wrap">
      <table className="stats">
        <thead>
          <tr>
            <th>{seedLabel}</th>
            <th className="left">Player</th>
            <th>GP</th>
            <th>W-L</th>
            <th>Pts</th>
            <th>Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={s.id}>
              <td className="mono rank">{i + 1}</td>
              <td className="left">{player(s.id).name}</td>
              <td className="mono">{s.gp}</td>
              <td className="mono">
                {s.w}-{s.l}
              </td>
              <td className="mono strong">{s.pts}</td>
              <td className="mono">{average(s).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
