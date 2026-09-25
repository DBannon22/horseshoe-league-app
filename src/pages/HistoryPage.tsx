import { useState } from 'react';
import { useLeague } from '../state';
import { PageHeader } from '../components';
import { AWARD_SUGGESTIONS, byYear, newHistoryId } from '../lib/history';
import type { History } from '../lib/types';

function copy(h: History): History {
  return {
    about: h.about,
    timeline: h.timeline.map((e) => ({ ...e })),
    champions: h.champions.map((c) => ({ ...c })),
    founders: h.founders.map((f) => ({ ...f })),
    presidents: h.presidents.map((p) => ({ ...p })),
  };
}

/** Drops rows left blank and trims the rest. */
function clean(h: History): History {
  return {
    about: h.about.trim(),
    timeline: h.timeline
      .map((e) => ({ ...e, year: e.year.trim(), text: e.text.trim() }))
      .filter((e) => e.year || e.text),
    champions: h.champions
      .map((c) => ({ ...c, year: c.year.trim(), award: c.award.trim(), winner: c.winner.trim() }))
      .filter((c) => c.year || c.award || c.winner),
    founders: h.founders.map((f) => ({ ...f, name: f.name.trim(), note: f.note.trim() })).filter((f) => f.name),
    presidents: h.presidents.map((p) => ({ ...p, year: p.year.trim(), name: p.name.trim() })).filter((p) => p.name),
  };
}

export function HistoryPage() {
  const { league, update, canEdit } = useLeague();
  const [draft, setDraft] = useState<History | null>(null);
  const history = league.history;

  const edit = (mutate: (h: History) => void) =>
    setDraft((d) => {
      const next = copy(d!);
      mutate(next);
      return next;
    });

  const save = () => {
    if (!draft) return;
    const cleaned = clean(draft);
    update((l) => {
      l.history = cleaned;
    });
    setDraft(null);
  };

  const cancel = () => {
    if (JSON.stringify(draft) !== JSON.stringify(history) && !window.confirm('Discard your changes to the history?'))
      return;
    setDraft(null);
  };

  if (draft) return <HistoryEditor draft={draft} edit={edit} save={save} cancel={cancel} />;

  const empty =
    !history.about &&
    !history.timeline.length &&
    !history.champions.length &&
    !history.founders.length &&
    !history.presidents.length;
  const timeline = byYear(history.timeline);
  const champions = byYear(history.champions, true);
  const presidents = byYear(history.presidents);
  const people = history.founders.length > 0 || presidents.length > 0;

  return (
    <section className="history">
      <PageHeader title="League History">
        {canEdit && (
          <button className="btn" onClick={() => setDraft(copy(history))}>
            Edit history
          </button>
        )}
      </PageHeader>

      {empty && (
        <div className="card empty">
          <p className="muted">
            {canEdit
              ? 'Nothing recorded yet. Use “Edit history” to add a few words about the league, its timeline, past champions, founding members and past presidents.'
              : 'The league’s history hasn’t been written up yet.'}
          </p>
        </div>
      )}

      {history.about && (
        <div className="card about">
          <h2>About the League</h2>
          <p>{history.about}</p>
        </div>
      )}

      {timeline.length > 0 && (
        <div className="card">
          <h2>Timeline</h2>
          <ol className="timeline">
            {timeline.map((e) => (
              <li key={e.id}>
                <span className="timeline-year">{e.year}</span>
                <p>{e.text}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(champions.length > 0 || people) && (
        <div className="two-col">
          {champions.length > 0 && (
            <div className="card">
              <h2>Past Champions</h2>
              <table className="champions">
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Award</th>
                    <th scope="col">Champion</th>
                  </tr>
                </thead>
                <tbody>
                  {champions.map((c, i) => {
                    const firstOfYear = i === 0 || champions[i - 1].year !== c.year;
                    return (
                      <tr key={c.id} className={firstOfYear && i > 0 ? 'year-start' : undefined}>
                        <td className="mono">{firstOfYear ? c.year : ''}</td>
                        <td>{c.award}</td>
                        <td className="strong">{c.winner}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {people && (
            <div className="history-side">
              {history.founders.length > 0 && (
                <div className="card">
                  <h2>Founding Members</h2>
                  <ul className="founders">
                    {history.founders.map((f) => (
                      <li key={f.id}>
                        <span className="strong">{f.name}</span>
                        {f.note && <span className="muted small">{f.note}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {presidents.length > 0 && (
                <div className="card">
                  <h2>Past Presidents</h2>
                  <ul className="presidents">
                    {presidents.map((p) => (
                      <li key={p.id}>
                        <span className="mono muted">{p.year}</span>
                        <span className="strong">{p.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function HistoryEditor({
  draft,
  edit,
  save,
  cancel,
}: {
  draft: History;
  edit: (mutate: (h: History) => void) => void;
  save: () => void;
  cancel: () => void;
}) {
  const awards = [...new Set([...AWARD_SUGGESTIONS, ...draft.champions.map((c) => c.award.trim()).filter(Boolean)])];
  const actions = (
    <>
      <button className="btn" onClick={cancel}>
        Cancel
      </button>
      <button className="btn primary" onClick={save}>
        Save history
      </button>
    </>
  );

  return (
    <section className="history">
      <PageHeader title="Edit history">{actions}</PageHeader>
      <p className="muted small history-help">
        Timeline events, champions and presidents are sorted by year when shown. Blank rows are dropped when you save.
      </p>

      <div className="card">
        <label className="field about-edit">
          <span className="about-label">About the League</span>
          <textarea
            value={draft.about}
            rows={5}
            placeholder="A few words about the league: where and when you play, how it started, what makes it special."
            onChange={(ev) =>
              edit((h) => {
                h.about = ev.target.value;
              })
            }
          />
        </label>
      </div>

      <div className="card">
        <h2>Timeline</h2>
        {draft.timeline.length > 0 && (
          <ul className="history-edit">
            {draft.timeline.map((e, i) => (
              <li key={e.id} className="timeline-edit">
                <input
                  value={e.year}
                  placeholder="Year"
                  className="mono"
                  aria-label="Year"
                  onChange={(ev) =>
                    edit((h) => {
                      h.timeline[i].year = ev.target.value;
                    })
                  }
                />
                <textarea
                  value={e.text}
                  rows={2}
                  placeholder="What happened"
                  aria-label={`What happened in ${e.year || 'this year'}`}
                  onChange={(ev) =>
                    edit((h) => {
                      h.timeline[i].text = ev.target.value;
                    })
                  }
                />
                <button
                  className="btn small"
                  onClick={() => edit((h) => void h.timeline.splice(i, 1))}
                  aria-label={`Remove ${e.year || 'this'} event`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          className="btn"
          onClick={() => edit((h) => void h.timeline.push({ id: newHistoryId(), year: '', text: '' }))}
        >
          Add event
        </button>
      </div>

      <div className="card">
        <h2>Past Champions</h2>
        <datalist id="award-suggestions">
          {awards.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        {draft.champions.length > 0 && (
          <ul className="history-edit">
            {draft.champions.map((c, i) => (
              <li key={c.id} className="champion-edit">
                <input
                  value={c.year}
                  placeholder="Year"
                  className="mono"
                  aria-label="Year"
                  onChange={(ev) =>
                    edit((h) => {
                      h.champions[i].year = ev.target.value;
                    })
                  }
                />
                <input
                  value={c.award}
                  placeholder="Award"
                  list="award-suggestions"
                  aria-label="Award"
                  onChange={(ev) =>
                    edit((h) => {
                      h.champions[i].award = ev.target.value;
                    })
                  }
                />
                <input
                  value={c.winner}
                  placeholder="Champion(s)"
                  aria-label="Champion"
                  onChange={(ev) =>
                    edit((h) => {
                      h.champions[i].winner = ev.target.value;
                    })
                  }
                />
                <button
                  className="btn small"
                  onClick={() => edit((h) => void h.champions.splice(i, 1))}
                  aria-label={`Remove ${c.winner || 'this champion'}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          className="btn"
          onClick={() =>
            edit((h) => {
              // Start from the last year entered, since several awards usually share one.
              const year = h.champions[h.champions.length - 1]?.year ?? '';
              h.champions.push({ id: newHistoryId(), year, award: '', winner: '' });
            })
          }
        >
          Add champion
        </button>
      </div>

      <div className="card">
        <h2>Founding Members</h2>
        {draft.founders.length > 0 && (
          <ul className="history-edit">
            {draft.founders.map((f, i) => (
              <li key={f.id} className="founder-edit">
                <input
                  value={f.name}
                  placeholder="Name"
                  aria-label="Name"
                  onChange={(ev) =>
                    edit((h) => {
                      h.founders[i].name = ev.target.value;
                    })
                  }
                />
                <input
                  value={f.note}
                  placeholder="Note (optional), e.g. first president"
                  aria-label={`Note for ${f.name || 'this member'}`}
                  onChange={(ev) =>
                    edit((h) => {
                      h.founders[i].note = ev.target.value;
                    })
                  }
                />
                <button
                  className="btn small"
                  onClick={() => edit((h) => void h.founders.splice(i, 1))}
                  aria-label={`Remove ${f.name || 'this member'}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          className="btn"
          onClick={() => edit((h) => void h.founders.push({ id: newHistoryId(), name: '', note: '' }))}
        >
          Add founding member
        </button>
      </div>

      <div className="card">
        <h2>Past Presidents</h2>
        {draft.presidents.length > 0 && (
          <ul className="history-edit">
            {draft.presidents.map((p, i) => (
              <li key={p.id} className="president-edit">
                <input
                  value={p.year}
                  placeholder="Term, e.g. 1998–2003"
                  className="mono"
                  aria-label="Term"
                  onChange={(ev) =>
                    edit((h) => {
                      h.presidents[i].year = ev.target.value;
                    })
                  }
                />
                <input
                  value={p.name}
                  placeholder="Name"
                  aria-label={`President for ${p.year || 'this term'}`}
                  onChange={(ev) =>
                    edit((h) => {
                      h.presidents[i].name = ev.target.value;
                    })
                  }
                />
                <button
                  className="btn small"
                  onClick={() => edit((h) => void h.presidents.splice(i, 1))}
                  aria-label={`Remove ${p.name || 'this president'}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          className="btn"
          onClick={() => edit((h) => void h.presidents.push({ id: newHistoryId(), year: '', name: '' }))}
        >
          Add president
        </button>
      </div>

      <div className="toolbar history-actions">{actions}</div>
    </section>
  );
}
