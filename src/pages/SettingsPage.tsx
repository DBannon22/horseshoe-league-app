import { useRef, useState } from 'react';
import { useLeague } from '../state';
import { PageHeader } from '../components';
import { defaultLeague, isLeague, migrateLeague } from '../lib/storage';
import { RANK_LABEL } from '../lib/standings';
import type { RankBy } from '../lib/types';

export function SettingsPage() {
  const { league, update, replace, cloudEnabled } = useLeague();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(league, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${league.settings.leagueName.replace(/[^\w-]+/g, '-').toLowerCase() || 'league'}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isLeague(parsed)) throw new Error('That file is not a league backup from this app.');
      if (!window.confirm('Replace everything here with the contents of this backup?')) return;
      replace(migrateLeague(parsed));
      setMessage('Backup loaded.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const reset = () => {
    if (!window.confirm('Delete the roster, schedule and every score? Export a backup first if unsure.')) return;
    replace(defaultLeague());
    setMessage('League reset.');
  };

  return (
    <section>
      <PageHeader title="Settings" />
      <div className="card">
        <div className="form-stack">
          <label className="field">
            <span>League name</span>
            <input
              value={league.settings.leagueName}
              onChange={(e) =>
                update((l) => {
                  l.settings.leagueName = e.target.value;
                })
              }
            />
          </label>
          <label className="field">
            <span>Rank standings and playoff seeds by</span>
            <select
              value={league.settings.rankBy}
              onChange={(e) =>
                update((l) => {
                  l.settings.rankBy = e.target.value as RankBy;
                })
              }
            >
              {(Object.keys(RANK_LABEL) as RankBy[]).map((k) => (
                <option key={k} value={k}>
                  {RANK_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted small">
          Ties are broken by the other two measures. Games per night is chosen when you generate the schedule.
        </p>
      </div>

      <div className="card">
        <h2>Data</h2>
        <p className="muted">
          {cloudEnabled
            ? 'Changes are saved online automatically and everyone with the link sees them right away. Export a backup now and then to keep your own copy.'
            : 'Everything is saved in this browser automatically. Export a backup regularly, and use it to move the league to another computer.'}
        </p>
        <div className="form-row">
          <button className="btn primary" onClick={exportJson}>
            Export backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
          <button className="btn danger" onClick={reset}>
            Reset league
          </button>
        </div>
        {message && <p className="small">{message}</p>}
      </div>
    </section>
  );
}
