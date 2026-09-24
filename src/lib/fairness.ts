import { isRegular, sideIds, type Player, type Schedule } from './types';

export interface FairnessReport {
  aIds: string[];
  bIds: string[];
  /** partner[a][b]: times A player a and B player b were teammates. */
  partner: number[][];
  /** cross[a][b]: times A player a faced B player b on the other team. */
  cross: number[][];
  /** aa[i][j]: times two A players faced each other (they pitch at the same end). */
  aa: number[][];
  bb: number[][];
  /** Per mover-night: how many times someone repeated a court, partner, or opponent. */
  nightRepeats: number;
}

const zeros = (n: number) => Array.from({ length: n }, () => new Array<number>(n).fill(0));

export function fairnessReport(schedule: Schedule, players: Player[]): FairnessReport {
  const aIds = sideIds(players, 'A');
  const bIds = sideIds(players, 'B');
  const ai = new Map(aIds.map((id, i) => [id, i]));
  const bi = new Map(bIds.map((id, i) => [id, i]));
  const partner = zeros(aIds.length);
  const cross = zeros(aIds.length);
  const aa = zeros(aIds.length);
  const bb = zeros(bIds.length);
  let nightRepeats = 0;

  for (const week of schedule.weeks) {
    if (!isRegular(week.phase)) continue;
    const seen = new Set<string>();
    const note = (k: string) => {
      if (seen.has(k)) nightRepeats++;
      else seen.add(k);
    };
    for (const game of week.games) {
      if (game.kind !== 'doubles') continue;
      const [t0, t1] = game.teams;
      const a0 = ai.get(t0.a)!, b0 = bi.get(t0.b)!, a1 = ai.get(t1.a)!, b1 = bi.get(t1.b)!;
      partner[a0][b0]++;
      partner[a1][b1]++;
      cross[a0][b1]++;
      cross[a1][b0]++;
      aa[a0][a1]++;
      aa[a1][a0]++;
      bb[b0][b1]++;
      bb[b1][b0]++;
      const movers = week.phase === 'A_STAYS' ? [t0.b, t1.b] : [t0.a, t1.a];
      for (const m of movers) note(`court:${m}:${game.court}`);
      note(`partner:${t0.a}:${t0.b}`);
      note(`partner:${t1.a}:${t1.b}`);
      note(`opp:${[movers[0], movers[1]].sort().join(':')}`);
    }
  }
  return { aIds, bIds, partner, cross, aa, bb, nightRepeats };
}

export function range(matrix: number[][], skipDiagonal = false): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  matrix.forEach((row, i) =>
    row.forEach((v, j) => {
      if (skipDiagonal && i === j) return;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }),
  );
  return { min, max };
}
