import { mulberry32, shuffle } from './rng';
import { roundRobin } from './roundRobin';
import { addDays } from './dates';
import {
  COURTS,
  PHASE_WEEKS,
  SIDE_SIZE,
  TOTAL_WEEKS,
  sideIds,
  type DoublesGame,
  type Phase,
  type Player,
  type Schedule,
  type Team,
  type Week,
} from './types';

/*
 * Regular season model
 * --------------------
 * Phase 0 (weeks 1–7): A players are "stationary". Each week the A side is
 * paired by round robin (so every A plays every other A once), and each A
 * pair holds one court for the whole night. B players are "movers": for every
 * game of the night they are placed into the 8 slots (court × team), which
 * decides who they partner and who they face.
 * Phase 1 (weeks 8–14): the same with the sides swapped.
 *
 * Step 1 builds each night from a template in which no mover visits a court
 * twice or faces the same mover twice (when the number of games allows it).
 * Step 2 is simulated annealing using only moves that keep those night rules
 * intact — relabelling two movers for a night, swapping the two movers on one
 * court, or swapping which stationary pair holds which court — while
 * minimising squared deviation from the ideal season counts for:
 *   - A–B partnerships
 *   - A–B opposition (facing the cross-side player on the other team)
 *   - mover-vs-mover opposition within each phase
 */

const N = SIDE_SIZE;
const C = COURTS;
const W = PHASE_WEEKS;

const WEIGHT = { partner: 10, cross: 6, moverOpp: 14 };

export interface PhasePlan {
  /** pairs[week][court] = the two stationary players (side index 0–7). */
  pairs: [number, number][][];
  /** perms[week][game][slot] = mover index; slot = court * 2 + team. */
  perms: Int8Array[][];
}

export interface Plan {
  phases: [PhasePlan, PhasePlan];
  cost: number;
}

/** One night's mover placements, satisfying court / opponent spread rules. */
function buildNight(G: number, rand: () => number): Int8Array[] {
  const limCourt = Math.ceil(G / C);
  const limOpp = Math.ceil(G / (N - 1));
  for (;;) {
    const courtCount = new Int8Array(N * C);
    const oppCount = new Int8Array(N * N);
    const games: Int8Array[] = [];
    for (let g = 0; g < G; g++) {
      const perm = new Int8Array(2 * C);
      const used = new Array<boolean>(N).fill(false);
      const fill = (c: number): boolean => {
        if (c === C) return true;
        const free = shuffle(
          Array.from({ length: N }, (_, i) => i).filter((m) => !used[m] && courtCount[m * C + c] < limCourt),
          rand,
        );
        for (let x = 0; x < free.length; x++)
          for (let y = x + 1; y < free.length; y++) {
            const m0 = free[x];
            const m1 = free[y];
            if (oppCount[m0 * N + m1] >= limOpp) continue;
            used[m0] = used[m1] = true;
            perm[2 * c] = m0;
            perm[2 * c + 1] = m1;
            if (fill(c + 1)) return true;
            used[m0] = used[m1] = false;
          }
        return false;
      };
      if (!fill(0)) break;
      for (let c = 0; c < C; c++) {
        const m0 = perm[2 * c];
        const m1 = perm[2 * c + 1];
        courtCount[m0 * C + c]++;
        courtCount[m1 * C + c]++;
        oppCount[m0 * N + m1]++;
        oppCount[m1 * N + m0]++;
      }
      games.push(perm);
    }
    if (games.length === G) return games;
  }
}

function optimizeOnce(G: number, rand: () => number, iterations: number): Plan {
  const indices = Array.from({ length: N }, (_, i) => i);
  const makePhase = (): PhasePlan => {
    const pairs = roundRobin(shuffle(indices, rand));
    return { pairs, perms: pairs.map(() => buildNight(G, rand)) };
  };
  const phases: [PhasePlan, PhasePlan] = [makePhase(), makePhase()];

  const target = (2 * W * G) / N;
  const partner = new Int16Array(N * N);
  const cross = new Int16Array(N * N);
  const moverOpp = [new Int16Array(N * N), new Int16Array(N * N)];

  let sign = 1;
  const quad = (arr: Int16Array, idx: number, t: number, w: number): number => {
    const c = arr[idx];
    arr[idx] = c + sign;
    const d = c - t;
    return w * (sign > 0 ? 2 * d + 1 : 1 - 2 * d);
  };
  // Index into an A×B matrix given a stationary and a mover index.
  const ab = (p: number, s: number, m: number) => (p === 0 ? s * N + m : m * N + s);
  const key = (x: number, y: number) => (x < y ? x * N + y : y * N + x);

  const applyGame = (p: number, w: number, g: number): number => {
    const pairs = phases[p].pairs[w];
    const perm = phases[p].perms[w][g];
    let d = 0;
    for (let c = 0; c < C; c++) {
      const s0 = pairs[c][0];
      const s1 = pairs[c][1];
      const m0 = perm[2 * c];
      const m1 = perm[2 * c + 1];
      d += quad(partner, ab(p, s0, m0), target, WEIGHT.partner);
      d += quad(partner, ab(p, s1, m1), target, WEIGHT.partner);
      d += quad(cross, ab(p, s0, m1), target, WEIGHT.cross);
      d += quad(cross, ab(p, s1, m0), target, WEIGHT.cross);
      d += quad(moverOpp[p], key(m0, m1), G, WEIGHT.moverOpp);
    }
    return d;
  };
  const applyWeek = (p: number, w: number): number => {
    let d = 0;
    for (let g = 0; g < G; g++) d += applyGame(p, w, g);
    return d;
  };

  // Cost of all-zero counts, so `cost` is absolute and comparable across restarts.
  let cost =
    (WEIGHT.partner + WEIGHT.cross) * N * N * target * target +
    WEIGHT.moverOpp * 2 * ((N * (N - 1)) / 2) * G * G;
  for (let p = 0; p < 2; p++) for (let w = 0; w < W; w++) cost += applyWeek(p, w);

  const swapIn = (perm: Int8Array, i: number, j: number) => {
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  };
  const relabel = (p: number, w: number, x: number, y: number) => {
    for (const perm of phases[p].perms[w])
      for (let s = 0; s < 2 * C; s++) {
        if (perm[s] === x) perm[s] = y;
        else if (perm[s] === y) perm[s] = x;
      }
  };
  const swapCourts = (p: number, w: number, c1: number, c2: number) => {
    const pairs = phases[p].pairs[w];
    const t = pairs[c1];
    pairs[c1] = pairs[c2];
    pairs[c2] = t;
  };

  const T0 = 30;
  const T1 = 0.2;
  const cool = Math.pow(T1 / T0, 1 / iterations);
  let T = T0;
  for (let it = 0; it < iterations; it++, T *= cool) {
    const p = rand() < 0.5 ? 0 : 1;
    const w = Math.floor(rand() * W);
    const r = rand();
    // doMove() applies a move; every move is its own inverse.
    let doMove: () => void;
    let weekLevel = true;
    let g = 0;
    if (r < 0.45) {
      const x = Math.floor(rand() * N);
      let y = Math.floor(rand() * (N - 1));
      if (y >= x) y++;
      doMove = () => relabel(p, w, x, y);
    } else if (r < 0.9) {
      g = Math.floor(rand() * G);
      const c = Math.floor(rand() * C);
      const perm = phases[p].perms[w][g];
      doMove = () => swapIn(perm, 2 * c, 2 * c + 1);
      weekLevel = false;
    } else {
      const c1 = Math.floor(rand() * C);
      let c2 = Math.floor(rand() * (C - 1));
      if (c2 >= c1) c2++;
      doMove = () => swapCourts(p, w, c1, c2);
    }
    const run = () => (weekLevel ? applyWeek(p, w) : applyGame(p, w, g));

    sign = -1;
    let delta = run();
    doMove();
    sign = 1;
    delta += run();

    if (delta <= 0 || rand() < Math.exp(-delta / T)) {
      cost += delta;
    } else {
      sign = -1;
      run();
      doMove();
      sign = 1;
      run();
    }
  }
  return { phases, cost };
}

export function optimizePlan(gamesPerNight: number, seed: number, restarts = 3): Plan {
  const rand = mulberry32(seed);
  // Week-level moves cost O(games per night), so fewer games can afford more iterations.
  const iterations = Math.round(400000 / gamesPerNight);
  let best: Plan | null = null;
  for (let r = 0; r < restarts; r++) {
    const plan = optimizeOnce(gamesPerNight, mulberry32(Math.floor(rand() * 2 ** 31)), iterations);
    if (!best || plan.cost < best.cost) best = plan;
  }
  return best!;
}

export function generateSchedule(
  players: Player[],
  startDate: string,
  gamesPerNight: number,
  seed: number,
): Schedule {
  const A = sideIds(players, 'A');
  const B = sideIds(players, 'B');
  const plan = optimizePlan(gamesPerNight, seed);
  const weeks: Week[] = [];

  plan.phases.forEach((phase, p) => {
    for (let w = 0; w < W; w++) {
      const number = p * W + w + 1;
      const games: DoublesGame[] = [];
      for (let g = 0; g < gamesPerNight; g++) {
        const perm = phase.perms[w][g];
        for (let c = 0; c < C; c++) {
          const teams = [0, 1].map((t): Team => {
            const s = phase.pairs[w][c][t];
            const m = perm[2 * c + t];
            return p === 0 ? { a: A[s], b: B[m] } : { a: A[m], b: B[s] };
          }) as [Team, Team];
          games.push({
            id: `w${number}-r${g + 1}-c${c + 1}`,
            kind: 'doubles',
            round: g + 1,
            court: c + 1,
            teams,
            scores: {},
          });
        }
      }
      weeks.push({
        number,
        date: addDays(startDate, 7 * (number - 1)),
        phase: (p === 0 ? 'A_STAYS' : 'B_STAYS') as Phase,
        games,
      });
    }
  });

  const playoffPhases: Phase[] = ['PLAYOFF_DOUBLES', 'PLAYOFF_SINGLES'];
  playoffPhases.forEach((phase, i) => {
    const number = 2 * W + i + 1;
    weeks.push({ number, date: addDays(startDate, 7 * (number - 1)), phase, games: [] });
  });

  if (weeks.length !== TOTAL_WEEKS) throw new Error('unexpected week count');

  return {
    startDate,
    seed,
    gamesPerNight,
    generatedAt: new Date().toISOString(),
    weeks,
    playoffSeeding: null,
  };
}
