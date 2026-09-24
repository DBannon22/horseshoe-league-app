import { roundRobin } from './roundRobin';
import { sideStandings, outcome, rank, type Stats } from './standings';
import {
  COURTS,
  SIDE_SIZE,
  type DoublesGame,
  type League,
  type PlayoffSeeding,
  type Schedule,
  type SinglesGame,
  type SinglesGroup,
  type Team,
  type Week,
} from './types';

/** A1 + B8, A2 + B7, … A8 + B1. */
export function doublesTeams(seeding: PlayoffSeeding): Team[] {
  return seeding.A.map((a, k) => ({ a, b: seeding.B[SIDE_SIZE - 1 - k] }));
}

export const SINGLES_GROUPS: SinglesGroup[] = ['A-Top', 'A-Bottom', 'B-Top', 'B-Bottom'];

export function singlesGroupIds(seeding: PlayoffSeeding, group: SinglesGroup): string[] {
  const side = group.startsWith('A') ? seeding.A : seeding.B;
  const half = SIDE_SIZE / 2;
  return group.endsWith('Top') ? side.slice(0, half) : side.slice(half);
}

function doublesGames(week: number, teams: Team[], gamesPerNight: number): DoublesGame[] {
  const rounds = roundRobin(teams.map((_, i) => i)).slice(0, Math.min(gamesPerNight, teams.length - 1));
  return rounds.flatMap((pairs, r) =>
    pairs.map(([x, y], c) => ({
      id: `w${week}-r${r + 1}-c${c + 1}`,
      kind: 'doubles' as const,
      round: r + 1,
      court: c + 1,
      teams: [teams[Math.min(x, y)], teams[Math.max(x, y)]] as [Team, Team],
      score: [null, null],
    })),
  );
}

/**
 * Each group of four plays a round robin (3 rounds of 2 matches). With four
 * courts, A groups and B groups alternate: A round 1, B round 1, A round 2…
 */
function singlesGames(week: number, seeding: PlayoffSeeding): SinglesGame[] {
  const games: SinglesGame[] = [];
  const bySide = [SINGLES_GROUPS.slice(0, 2), SINGLES_GROUPS.slice(2)];
  const groupRounds = new Map(SINGLES_GROUPS.map((g) => [g, roundRobin(singlesGroupIds(seeding, g))]));
  const roundsPerGroup = SIDE_SIZE / 2 - 1;
  let slot = 0;
  for (let r = 0; r < roundsPerGroup; r++)
    for (const groups of bySide) {
      slot++;
      let court = 0;
      for (const group of groups)
        for (const [p0, p1] of groupRounds.get(group)![r]) {
          court++;
          games.push({
            id: `w${week}-r${slot}-c${court}`,
            kind: 'singles',
            round: slot,
            court: ((court - 1) % COURTS) + 1,
            group,
            players: [p0, p1],
            score: [null, null],
          });
        }
    }
  return games;
}

export function hasScores(week: Week): boolean {
  return week.games.some((g) => g.score.some((v) => v !== null));
}

/** Seeds both playoff weeks from regular-season standings. */
export function seedPlayoffs(league: League): Schedule {
  if (!league.schedule) throw new Error('No schedule');
  const schedule = structuredClone(league.schedule);
  const seeding: PlayoffSeeding = {
    A: sideStandings(league, 'A').map((s) => s.id),
    B: sideStandings(league, 'B').map((s) => s.id),
    seededAt: new Date().toISOString(),
  };
  schedule.playoffSeeding = seeding;
  for (const week of schedule.weeks) {
    if (week.phase === 'PLAYOFF_DOUBLES')
      week.games = doublesGames(week.number, doublesTeams(seeding), schedule.gamesPerNight);
    if (week.phase === 'PLAYOFF_SINGLES') week.games = singlesGames(week.number, seeding);
  }
  return schedule;
}

export interface TeamStats extends Stats {
  team: Team;
  seed: number;
}

/** Doubles playoff: team totals across the night. */
export function doublesStandings(league: League): TeamStats[] {
  const schedule = league.schedule;
  const seeding = schedule?.playoffSeeding;
  if (!schedule || !seeding) return [];
  const week = schedule.weeks.find((w) => w.phase === 'PLAYOFF_DOUBLES')!;
  const key = (t: Team) => `${t.a}|${t.b}`;
  const rows = doublesTeams(seeding).map(
    (team, i): TeamStats => ({ id: key(team), team, seed: i + 1, gp: 0, w: 0, l: 0, pts: 0 }),
  );
  const byKey = new Map(rows.map((r) => [r.id, r]));
  for (const game of week.games) {
    if (game.kind !== 'doubles') continue;
    const o = outcome(game);
    if (!o.complete) continue;
    game.teams.forEach((team, i) => {
      const row = byKey.get(key(team));
      if (!row) return;
      row.gp++;
      row.pts += o.totals[i];
      if (o.winner === i) row.w++;
      else row.l++;
    });
  }
  return rank(rows, league.settings.rankBy);
}
