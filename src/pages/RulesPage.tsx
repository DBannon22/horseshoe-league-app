import { useState } from 'react';
import { useLeague } from '../state';
import { PageHeader } from '../components';
import { boldParts, defaultRules, ruleBlocks } from '../lib/rules';
import type { RuleSection } from '../lib/types';

function Bold({ text }: { text: string }) {
  return (
    <>
      {boldParts(text).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
    </>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <>
      {ruleBlocks(text).map((b, i) =>
        b.kind === 'text' ? (
          <p key={i}>
            <Bold text={b.text} />
          </p>
        ) : (
          <ul key={i} className="rules-sub">
            {b.items.map((item, j) => (
              <li key={j}>
                <Bold text={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

export function RulesPage() {
  const { league, update, canEdit } = useLeague();
  const [draft, setDraft] = useState<RuleSection[] | null>(null);

  const edit = (mutate: (sections: RuleSection[]) => void) =>
    setDraft((d) => {
      const next = (d ?? []).map((s) => ({ title: s.title, rules: [...s.rules] }));
      mutate(next);
      return next;
    });

  const save = () => {
    if (!draft) return;
    const cleaned = draft
      .map((s) => ({ title: s.title.trim(), rules: s.rules.map((r) => r.trim()).filter(Boolean) }))
      .filter((s) => s.title || s.rules.length);
    update((l) => {
      l.rules = cleaned;
    });
    setDraft(null);
  };

  const cancel = () => {
    if (JSON.stringify(draft) !== JSON.stringify(league.rules) && !window.confirm('Discard your changes to the rules?'))
      return;
    setDraft(null);
  };

  const restore = () => {
    if (!window.confirm('Replace the rules being edited with the original printed rule sheet?')) return;
    setDraft(defaultRules());
  };

  if (draft)
    return (
      <section className="rules">
        <PageHeader title="Edit rules">
          <button className="btn" onClick={cancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save rules
          </button>
        </PageHeader>
        <p className="muted small rules-help">
          Wrap words in <span className="mono">**double stars**</span> to make them bold. Start a line with{' '}
          <span className="mono">- </span> to make it a bullet point. Blank rules are dropped when you save.
        </p>
        {draft.map((s, si) => (
          <div className="card" key={si}>
            <div className="rules-edit-head">
              <label className="field">
                <span>Section title</span>
                <input
                  value={s.title}
                  onChange={(e) =>
                    edit((d) => {
                      d[si].title = e.target.value;
                    })
                  }
                />
              </label>
              <div className="rules-edit-actions">
                <button
                  className="btn small"
                  disabled={si === 0}
                  onClick={() => edit((d) => move(d, si, si - 1))}
                  aria-label={`Move section ${s.title} up`}
                >
                  ↑
                </button>
                <button
                  className="btn small"
                  disabled={si === draft.length - 1}
                  onClick={() => edit((d) => move(d, si, si + 1))}
                  aria-label={`Move section ${s.title} down`}
                >
                  ↓
                </button>
                <button
                  className="btn small danger"
                  onClick={() => {
                    if (window.confirm(`Remove the whole “${s.title || 'untitled'}” section?`))
                      edit((d) => void d.splice(si, 1));
                  }}
                >
                  Remove section
                </button>
              </div>
            </div>
            <ol className="rules-edit-list">
              {s.rules.map((r, ri) => (
                <li key={ri}>
                  <textarea
                    value={r}
                    rows={Math.max(2, Math.ceil(r.length / 90) + (r.match(/\n/g)?.length ?? 0))}
                    aria-label={`${s.title} rule ${ri + 1}`}
                    onChange={(e) =>
                      edit((d) => {
                        d[si].rules[ri] = e.target.value;
                      })
                    }
                  />
                  <div className="rules-edit-actions">
                    <button
                      className="btn small"
                      disabled={ri === 0}
                      onClick={() => edit((d) => move(d[si].rules, ri, ri - 1))}
                      aria-label={`Move rule ${ri + 1} up`}
                    >
                      ↑
                    </button>
                    <button
                      className="btn small"
                      disabled={ri === s.rules.length - 1}
                      onClick={() => edit((d) => move(d[si].rules, ri, ri + 1))}
                      aria-label={`Move rule ${ri + 1} down`}
                    >
                      ↓
                    </button>
                    <button
                      className="btn small"
                      onClick={() => edit((d) => void d[si].rules.splice(ri, 1))}
                      aria-label={`Remove rule ${ri + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <button className="btn" onClick={() => edit((d) => void d[si].rules.push(''))}>
              Add rule
            </button>
          </div>
        ))}
        <div className="toolbar">
          <button className="btn" onClick={() => edit((d) => void d.push({ title: 'New section', rules: [''] }))}>
            Add section
          </button>
          <button className="btn" onClick={restore}>
            Restore printed rules
          </button>
                    <button className="btn" onClick={cancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save rules
          </button>
        </div>
      </section>
    );

  return (
    <section className="rules">
      <PageHeader title="Rules">
        {canEdit && (
          <button className="btn" onClick={() => setDraft(league.rules.map((s) => ({ ...s, rules: [...s.rules] })))}>
            Edit rules
          </button>
        )}
      </PageHeader>
      <p className="muted rules-source">Brodhagen Wednesday Night Horseshoe League · Revised September 1998</p>
      {league.rules.length === 0 && (
        <div className="card empty">
          <p className="muted">No rules have been posted yet.</p>
        </div>
      )}
      {league.rules.map((s, si) => (
        <div className="card" key={si}>
          <h2>{s.title}</h2>
          <ol className="rules-list">
            {s.rules.map((r, ri) => (
              <li key={ri}>
                <Rule text={r} />
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
