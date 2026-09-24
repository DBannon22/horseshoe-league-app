import { isRegular, sideIds, type Game, type League, type RankBy, type Side, type Week } from './types';

export interface Outcome {
  /** Both scores entered and different. Horseshoes has no ties, so an even score doesn't count. */
  complete: boolean;
  /** Both scores entered but equal — almost certainly a typo. */
  even: boolean;
  totals: [number, number];
  /** 0 or 1 for the winning side, null while the game isn't complete. */
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
  const entered = game.score.every((v) => typeof v === 'number');
  const totals: [number, number] = [game.score[0] ?? 0, game.score[1] ?? 0];
  const even = entered && totals[0] === totals[1];
  const complete = entered && !even;
  const winner: 0 | 1 | null = complete ? (totals[0] > totals[1] ? 0 : 1) : null;
  return { complete, even, totals, winner };
}

export interface Stats {
  id: string;
  gp: number;
  w: number;
  l: number;
  pts: number;
}

export const average = (s: Stats) => (s.gp ? s.pts / s.gp : 0);
const winScore = (s: Stats) => s.w;

/** Individual stats: each player is credited with their team's score and result. */
export function playerStats(games: Game[], ids: string[]): Stats[] {
  const map = new Map(ids.map((id): [string, Stats] => [id, { id, gp: 0, w: 0, l: 0, pts: 0 }]));
  for (const game of games) {
    const o = outcome(game);
    if (!o.complete) continue;
    gameSides(game).forEach((side, i) => {
      for (const id of side) {
        const s = map.get(id);
        if (!s) continue;
        s.gp++;
        s.pts += o.totals[i];
        if (o.winner === i) s.w++;
        else s.l++;
      }
    });
  }
  return ids.map((id) => map.get(id)!);
}

/** Sort best-first. Players level on one measure fall back to the others, then input order. */
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
