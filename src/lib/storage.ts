import type { Game, League, Player, Score, Side } from './types';
import { DEFAULT_WINNING_SCORE, SIDE_SIZE } from './types';

const KEY = 'horseshoe-league:v1';

export function defaultLeague(): League {
  const players: Player[] = [];
  for (const side of ['A', 'B'] as Side[])
    for (let slot = 1; slot <= SIDE_SIZE; slot++)
      players.push({ id: `${side}${slot}`, name: `${side} Player ${slot}`, side, slot });
  return {
    version: 1,
    players,
    settings: {
      leagueName: 'Horseshoe League',
      gamesPerNight: 4,
      rankBy: 'points',
      winningScore: DEFAULT_WINNING_SCORE,
    },
    schedule: null,
    spares: [],
  };
}

export function isLeague(x: unknown): x is League {
  const l = x as League;
  return (
    !!l &&
    l.version === 1 &&
    Array.isArray(l.players) &&
    l.players.length === SIDE_SIZE * 2 &&
    !!l.settings &&
    typeof l.settings.gamesPerNight === 'number' &&
    'schedule' in l
  );
}

type LegacyGame = Game & { scores?: Record<string, number> };

/**
 * Older saves stored points per player. Convert them to one score per side
 * (the partners' points added together) so nothing already entered is lost.
 */
export function migrateLeague(league: League): League {
  for (const week of league.schedule?.weeks ?? [])
    for (const g of week.games as LegacyGame[]) {
      if (g.score) continue;
      const sides = g.kind === 'doubles' ? g.teams.map((t) => [t.a, t.b]) : g.players.map((p) => [p]);
      const old = g.scores ?? {};
      g.score = sides.map((ids) =>
        ids.every((id) => typeof old[id] === 'number') ? ids.reduce((sum, id) => sum + old[id], 0) : null,
      ) as Score;
      delete g.scores;
    }
  // Leagues saved before the winning-score setting existed.
  if (typeof league.settings.winningScore !== 'number') league.settings.winningScore = DEFAULT_WINNING_SCORE;
  // Leagues saved before the spares list existed.
  if (!Array.isArray(league.spares)) league.spares = [];
  return league;
}

export function loadLeague(): League {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isLeague(parsed)) return migrateLeague(parsed);
    }
  } catch {
    // Storage unavailable or corrupt — start fresh.
  }
  return defaultLeague();
}

/** True when this browser has league data saved from local mode. */
export function hasLocalLeague(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function saveLeague(league: League): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(league));
  } catch {
    // Ignore quota / privacy-mode failures; export still works.
  }
}
