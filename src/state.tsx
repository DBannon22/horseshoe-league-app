import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import { cloud } from './lib/cloud';
import { defaultLeague, loadLeague, migrateLeague, saveLeague } from './lib/storage';
import type { League, Player } from './lib/types';

/**
 * loading → first cloud read pending; missing → cloud has no league yet;
 * signed-out → nobody signed in (the league is members-only);
 * denied → signed in, but this account isn't a member or admin.
 */
export type LeagueStatus = 'loading' | 'ready' | 'missing' | 'error' | 'signed-out' | 'denied';
export type SaveState = 'saved' | 'saving' | 'error';

interface LeagueContextValue {
  league: League;
  status: LeagueStatus;
  /** True when connected to Firebase; false in local (single-browser) mode. */
  cloudEnabled: boolean;
  /** Whether the current visitor may change anything. */
  canEdit: boolean;
  user: User | null;
  isAdmin: boolean;
  authReady: boolean;
  saveState: SaveState;
  error: string;
  /** Apply a mutation to a fresh copy of the league. */
  update: (mutate: (draft: League) => void) => void;
  replace: (league: League) => void;
  player: (id: string) => Player;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

const SAVE_DELAY_MS = 600;

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [league, setLeague] = useState<League | null>(() => (cloud ? null : loadLeague()));
  const [status, setStatus] = useState<LeagueStatus>(cloud ? 'loading' : 'ready');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(!cloud);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [error, setError] = useState('');

  const leagueRef = useRef(league);
  // A debounced cloud write that hasn't gone out yet; incoming snapshots are
  // ignored meanwhile so they can't overwrite what the admin is typing.
  const pending = useRef<number | null>(null);

  useEffect(() => {
    if (!cloud && league) saveLeague(league);
  }, [league]);

  useEffect(() => {
    if (!cloud) return;
    const stopAuth = cloud.watchAuth(async (u) => {
      setUser(u);
      setIsAdmin(u ? await cloud!.isAdmin(u.uid) : false);
      setAuthReady(true);
    });
    const warnUnsaved = (e: BeforeUnloadEvent) => {
      if (pending.current !== null) e.preventDefault();
    };
    window.addEventListener('beforeunload', warnUnsaved);
    return () => {
      stopAuth();
      window.removeEventListener('beforeunload', warnUnsaved);
    };
  }, []);

  // The league is members-only, so only listen for it while someone is signed in.
  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!cloud || !authReady) return;
    if (!uid) {
      leagueRef.current = null;
      setLeague(null);
      setStatus('signed-out');
      return;
    }
    setStatus('loading');
    return cloud.watchLeague(
      (remote) => {
        if (pending.current !== null) return;
        const next = remote ? migrateLeague(remote) : null;
        leagueRef.current = next;
        setLeague(next);
        setStatus(next ? 'ready' : 'missing');
      },
      (e) => {
        if ((e as { code?: string }).code === 'permission-denied') setStatus('denied');
        else {
          setStatus('error');
          setError(e.message);
        }
      },
    );
  }, [uid, authReady]);

  const commit = useCallback((next: League) => {
    leagueRef.current = next;
    setLeague(next);
    setStatus('ready');
    if (!cloud) return;
    setSaveState('saving');
    if (pending.current !== null) window.clearTimeout(pending.current);
    const timer = window.setTimeout(async () => {
      try {
        await cloud!.saveLeague(leagueRef.current!);
        setSaveState('saved');
        setError('');
      } catch (e) {
        setSaveState('error');
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (pending.current === timer) pending.current = null;
      }
    }, SAVE_DELAY_MS);
    pending.current = timer;
  }, []);

  const update = useCallback(
    (mutate: (draft: League) => void) => {
      const next = structuredClone(leagueRef.current ?? defaultLeague());
      mutate(next);
      commit(next);
    },
    [commit],
  );

  const value = useMemo((): LeagueContextValue => {
    const current = league ?? defaultLeague();
    const byId = new Map(current.players.map((p) => [p.id, p]));
    return {
      league: current,
      status,
      cloudEnabled: !!cloud,
      canEdit: !cloud || isAdmin,
      user,
      isAdmin,
      authReady,
      saveState,
      error,
      update,
      replace: commit,
      player: (id) => byId.get(id) ?? { id, name: id, side: 'A', slot: 0 },
      signIn: async (email, password) => {
        if (!cloud) throw new Error('Login is not set up.');
        await cloud.signIn(email, password);
      },
      signOut: async () => {
        await cloud?.signOut();
      },
    };
  }, [league, status, user, isAdmin, authReady, saveState, error, update, commit]);

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
