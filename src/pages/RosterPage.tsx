import { useState } from 'react';
import { useLeague } from '../state';
import { PageHeader } from '../components';
import { formatPhone, newSpareId, parseSpares, telHref } from '../lib/spares';

export function RosterPage() {
  const { league, update, canEdit } = useLeague();
  const rename = (id: string, name: string) =>
    update((l) => {
      l.players.find((p) => p.id === id)!.name = name;
    });

  return (
    <section>
      <PageHeader title="Roster" />
      <p className="muted">
        Eight players per side. The numbers are roster spots only — playoff seeds come from the standings.
        {canEdit && ' Renaming a player keeps all of their games and scores.'}
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
                    {canEdit ? (
                      <input
                        value={p.name}
                        onChange={(e) => rename(p.id, e.target.value)}
                        aria-label={`${side} side player ${p.slot}`}
                      />
                    ) : (
                      <span className="roster-name">{p.name}</span>
                    )}
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>
      <Spares />
    </section>
  );
}

function Spares() {
  const { league, update, canEdit } = useLeague();
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState('');
  const spares = league.spares;
  // Open to start with when the list is empty; after that it's the admin's choice.
  const [pasteOpen, setPasteOpen] = useState(spares.length === 0);

  const edit = (id: string, field: 'name' | 'phone', value: string) =>
    update((l) => {
      l.spares.find((s) => s.id === id)![field] = value;
    });
  const remove = (id: string, name: string) => {
    if (!window.confirm(`Remove ${name || 'this spare'} from the list?`)) return;
    update((l) => {
      l.spares = l.spares.filter((s) => s.id !== id);
    });
  };
  const add = () =>
    update((l) => {
      l.spares.push({ id: newSpareId(), name: '', phone: '' });
    });
  const addPasted = () => {
    const parsed = parseSpares(paste);
    const known = new Set(spares.map((s) => s.name.toLowerCase()));
    const fresh = parsed.filter((s) => !known.has(s.name.toLowerCase()));
    if (fresh.length)
      update((l) => {
        l.spares.push(...fresh.map((s) => ({ ...s, id: newSpareId() })));
      });
    const skipped = parsed.length - fresh.length;
    setMessage(
      `Added ${fresh.length} spare${fresh.length === 1 ? '' : 's'}` +
        (skipped ? ` (${skipped} already on the list)` : '') +
        '.',
    );
    if (fresh.length) setPaste('');
  };

  return (
    <div className="card spares">
      <div className="section-head">
        <h2>Spares</h2>
        <span className="muted small">Book as early as possible.</span>
      </div>

      {spares.length === 0 && !canEdit && <p className="muted">No spares listed yet.</p>}

      {canEdit ? (
        <>
          {spares.length > 0 && (
            <ul className="spare-edit">
              {spares.map((s) => (
                <li key={s.id}>
                  <input
                    value={s.name}
                    placeholder="Name"
                    onChange={(e) => edit(s.id, 'name', e.target.value)}
                    aria-label="Spare name"
                  />
                  <input
                    value={s.phone}
                    placeholder="Phone"
                    inputMode="tel"
                    className="mono"
                    onChange={(e) => edit(s.id, 'phone', e.target.value)}
                    aria-label={`Phone for ${s.name || 'spare'}`}
                  />
                  <button className="btn small" onClick={() => remove(s.id, s.name)} aria-label={`Remove ${s.name}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="form-row">
            <button className="btn" onClick={add}>
              Add spare
            </button>
          </div>
          <details
            className="spare-paste"
            open={pasteOpen}
            onToggle={(e) => setPasteOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary>Paste a list</summary>
            <p className="muted small">One spare per line, name then phone number, e.g. “Pat Smith 519.555.0100”.</p>
            <textarea
              rows={8}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              aria-label="Paste spares, one per line"
            />
            <div className="form-row">
              <button className="btn primary" onClick={addPasted} disabled={!paste.trim()}>
                Add these spares
              </button>
              {message && <span className="small">{message}</span>}
            </div>
          </details>
          <p className="muted small">Everyone who opens the website can see this list, including phone numbers.</p>
        </>
      ) : (
        spares.length > 0 && (
          <ul className="spare-list">
            {spares.map((s) => (
              <li key={s.id}>
                <span className="spare-name">{s.name}</span>
                {s.phone && (
                  <a className="spare-phone mono" href={telHref(s.phone)}>
                    {formatPhone(s.phone)}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
