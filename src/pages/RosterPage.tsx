import { useLeague } from '../state';
import { PageHeader } from '../components';

export function RosterPage() {
  const { league, update } = useLeague();
  const rename = (id: string, name: string) =>
    update((l) => {
      l.players.find((p) => p.id === id)!.name = name;
    });

  return (
    <section>
      <PageHeader title="Roster" />
      <p className="muted">
        Eight players per side. The numbers are roster spots only — playoff seeds come from the standings. Renaming a
        player keeps all of their games and scores.
      </p>
      <div className="two-col">
        {(['A', 'B'] as const).map((side) => (
          <div key={side} className="card">
            <h2>{side} side</h2>
            <ol className="roster">
              {league.players
                .filter((p) => p.side === side)
                .sort((x, y) => x.slot - y.slot)
                .map((p) => (
                  <li key={p.id}>
                    <span className={`side-tag side-${side} mono`}>
                      {side}
                      {p.slot}
                    </span>
                    <input
                      value={p.name}
                      onChange={(e) => rename(p.id, e.target.value)}
                      aria-label={`${side} side player ${p.slot}`}
                    />
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
