import type { ReactNode } from 'react';
import { useLeague } from './state';
import { PHASE_LABEL, type Phase } from './lib/types';

export function Name({ id, mark }: { id: string; mark?: string }) {
  const { player } = useLeague();
  const p = player(id);
  return (
    <span className={`name${mark === id ? ' marked' : ''}`}>
      <span className={`side-tag side-${p.side}`}>{p.side}</span>
      {p.name}
    </span>
  );
}

export function PhaseBadge({ phase }: { phase: Phase }) {
  return <span className={`phase phase-${phase}`}>{PHASE_LABEL[phase]}</span>;
}

export function Progress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const complete = done === total;
  return (
    <span className={`progress${complete ? ' complete' : ''}`}>
      <span className="mono">
        {done}/{total}
      </span>{' '}
      scored
    </span>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function NoSchedule() {
  return (
    <div className="card empty">
      <p>No schedule yet.</p>
      <a className="btn primary" href="#/schedule">
        Generate a schedule
      </a>
    </div>
  );
}
