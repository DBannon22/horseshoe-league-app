import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadLeague, saveLeague } from './lib/storage';
import type { League, Player } from './lib/types';

interface LeagueContextValue {
  league: League;
  /** Apply a mutation to a fresh copy of the league. */
  update: (mutate: (draft: League) => void) => void;
  replace: (league: League) => void;
  player: (id: string) => Player;
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [league, setLeague] = useState<League>(loadLeague);

  useEffect(() => saveLeague(league), [league]);

  const update = useCallback((mutate: (draft: League) => void) => {
    setLeague((prev) => {
      const next = structuredClone(prev);
      mutate(next);
      return next;
    });
  }, []);

  const value = useMemo((): LeagueContextValue => {
    const byId = new Map(league.players.map((p) => [p.id, p]));
    return {
      league,
      update,
      replace: setLeague,
      player: (id) => byId.get(id) ?? { id, name: id, side: 'A', slot: 0 },
    };
  }, [league, update]);

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error('useLeague must be used inside LeagueProvider');
  return ctx;
}

export function useHashRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
