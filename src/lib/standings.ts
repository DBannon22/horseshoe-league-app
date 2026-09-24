import { isRegular, sideIds, type Game, type League, type RankBy, type Side, type Week } from './types';

export interface Outcome {
  complete: boolean;
  totals: [number, number];
  /** 0 or 1 for the winning side, null for a tie or an unfinished game. */
  winner: 0 | 1 | null;
}

/** The player ids on each side of a game. */
export function gameSides(game: Game): [string[], string[]] {
  return game.kind === 'doubles'
    ? [
        [game.teams[0].a, game.teams[0].b],
        [game.teams[1].a, game.teams[1].b],
      ]
    : [[game.players[0]], [game.players[1]]];
}

export function outcome(game: Game): Outcome {
  const sides = gameSides(game);
  const complete = sides.flat().every((id) => typeof game.scores[id] === 'number');
  const totals = sides.map((ids) => ids.reduce((sum, id) => sum + (game.scores[id] ?? 0), 0)) as [number, number];
  let winner: 0 | 1 | null = null;
  if (complete && totals[0] !== totals[1]) winner = totals[0] > totals[1] ? 0 : 1;
  return { complete, totals, winner };
}

export interface Stats {
  id: string;
  gp: number;
  w: number;
  l: number;
  t: number;
  pts: number;
}

export const average = (s: Stats) => (s.gp ? s.pts / s.gp : 0);
const winScore = (s: Stats) => s.w + s.t / 2;

/** Individual stats: each player's own points; W/L/T follow their team's result. */
export function playerStats(games: Game[], ids: string[]): Stats[] {
  const map = new Map(ids.map((id): [string, Stats] => [id, { id, gp: 0, w: 0, l: 0, t: 0, pts: 0 }]));
  for (const game of games) {
    const o = outcome(game);
    if (!o.complete) continue;
    gameSides(game).forEach((side, i) => {
      for (const id of side) {
        const s = map.get(id);
        if (!s) continue;
        s.gp++;
        s.pts += game.scores[id];
        if (o.winner === null) s.t++;
        else if (o.winner === i) s.w++;
        else s.l++;
      }
    });
  }
  return ids.map((id) => map.get(id)!);
}

/** Sort best-first. Ties fall back to the other measures, then to input order. */
export function rank<T extends Stats>(rows: T[], rankBy: RankBy): T[] {
  const order = new Map(rows.map((r, i) => [r, i]));
  const keys: Record<RankBy, ((s: Stats) => number)[]> = {
    points: [(s) => s.pts, winScore, average],
    average: [average, (s) => s.pts, winScore],
    wins: [winScore, (s) => s.pts, average],
  };
  return rows.slice().sort((x, y) => {
    for (const k of keys[rankBy]) {
      const d = k(y) - k(x);
      if (Math.abs(d) > 1e-9) return d;
    }
    return order.get(x)! - order.get(y)!;
  });
}

export const RANK_LABEL: Record<RankBy, string> = {
  points: 'Total points',
  average: 'Points per game',
  wins: 'Wins',
};

export function regularGames(weeks: Week[]): Game[] {
  return weeks.filter((w) => isRegular(w.phase)).flatMap((w) => w.games);
}

export function sideStandings(league: League, side: Side): Stats[] {
  const ids = sideIds(league.players, side);
  const games = league.schedule ? regularGames(league.schedule.weeks) : [];
  return rank(playerStats(games, ids), league.settings.rankBy);
}

export function progress(games: Game[]): { done: number; total: number } {
  return { done: games.filter((g) => outcome(g).complete).length, total: games.length };
}
