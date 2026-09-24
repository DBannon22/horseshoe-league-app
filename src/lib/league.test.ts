import { describe, expect, test } from 'vitest';
import { generateSchedule } from './scheduler';
import { fairnessReport, range } from './fairness';
import { defaultLeague } from './storage';
import { roundRobin } from './roundRobin';
import { doublesStandings, doublesTeams, seedPlayoffs, singlesGroupIds } from './playoffs';
import { outcome, sideStandings } from './standings';
import { isRegular, type League } from './types';

const players = defaultLeague().players;

describe('roundRobin', () => {
  test('every pair meets exactly once', () => {
    const rounds = roundRobin([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(rounds).toHaveLength(7);
    const seen = new Set<string>();
    for (const round of rounds) {
      expect(new Set(round.flat()).size).toBe(8);
      for (const [x, y] of round) seen.add([x, y].sort().join('-'));
    }
    expect(seen.size).toBe(28);
  });
});

describe('generateSchedule', () => {
  const schedule = generateSchedule(players, '2026-10-01', 4, 42);

  test('16 weekly dates from the start date', () => {
    expect(schedule.weeks).toHaveLength(16);
    expect(schedule.weeks[0].date).toBe('2026-10-01');
    expect(schedule.weeks[1].date).toBe('2026-10-08');
    expect(schedule.weeks[15].date).toBe('2027-01-14');
    expect(schedule.weeks.map((w) => w.phase)).toEqual([
      ...Array(7).fill('A_STAYS'),
      ...Array(7).fill('B_STAYS'),
      'PLAYOFF_DOUBLES',
      'PLAYOFF_SINGLES',
    ]);
  });

  test('every player plays every game, stationary pair keeps its court all night', () => {
    for (const week of schedule.weeks.filter((w) => isRegular(w.phase))) {
      const byRound = new Map<number, string[]>();
      const courtOf = new Map<string, number>();
      for (const g of week.games) {
        if (g.kind !== 'doubles') throw new Error('expected doubles');
        const ids = [g.teams[0].a, g.teams[0].b, g.teams[1].a, g.teams[1].b];
        byRound.set(g.round, [...(byRound.get(g.round) ?? []), ...ids]);
        const stay = week.phase === 'A_STAYS' ? [g.teams[0].a, g.teams[1].a] : [g.teams[0].b, g.teams[1].b];
        for (const id of stay) {
          if (courtOf.has(id)) expect(courtOf.get(id)).toBe(g.court);
          courtOf.set(id, g.court);
        }
      }
      for (const ids of byRound.values()) expect(new Set(ids).size).toBe(16);
    }
  });

  test('with 4 games a night the season is perfectly balanced', () => {
    const r = fairnessReport(schedule, players);
    expect(range(r.partner)).toEqual({ min: 7, max: 7 });
    expect(range(r.cross)).toEqual({ min: 7, max: 7 });
    expect(range(r.aa, true)).toEqual({ min: 8, max: 8 });
    expect(range(r.bb, true)).toEqual({ min: 8, max: 8 });
    expect(r.nightRepeats).toBe(0);
  });

  test('with 1 game a night partners are as even as possible', () => {
    const r = fairnessReport(generateSchedule(players, '2026-10-01', 1, 7), players);
    const { min, max } = range(r.partner);
    expect(min).toBeGreaterThanOrEqual(1);
    expect(max).toBeLessThanOrEqual(2);
    expect(range(r.aa, true)).toEqual({ min: 2, max: 2 });
    expect(range(r.bb, true)).toEqual({ min: 2, max: 2 });
  });

  test('same seed reproduces the same schedule', () => {
    const again = generateSchedule(players, '2026-10-01', 4, 42);
    expect(again.weeks.map((w) => w.games)).toEqual(schedule.weeks.map((w) => w.games));
  });
});

describe('scoring and playoffs', () => {
  // Deterministic fake scores: A1 is best on A side, B1 best on B side.
  const league: League = { ...defaultLeague(), schedule: generateSchedule(players, '2026-10-01', 2, 3) };
  const slot = (id: string) => Number(id.slice(1));
  for (const week of league.schedule!.weeks)
    for (const g of week.games) {
      if (g.kind !== 'doubles') continue;
      for (const t of g.teams) {
        g.scores[t.a] = 20 - slot(t.a);
        g.scores[t.b] = 20 - slot(t.b);
      }
    }

  test('outcome sums partners and picks a winner', () => {
    const o = outcome({
      id: 'x',
      kind: 'doubles',
      round: 1,
      court: 1,
      teams: [
        { a: 'A1', b: 'B1' },
        { a: 'A2', b: 'B2' },
      ],
      scores: { A1: 10, B1: 5, A2: 8, B2: 6 },
    });
    expect(o).toEqual({ complete: true, totals: [15, 14], winner: 0 });
  });

  test('standings rank by total points', () => {
    expect(sideStandings(league, 'A').map((s) => s.id)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8']);
  });

  test('doubles playoff pairs A1+B8 … A8+B1, singles splits top/bottom four', () => {
    const schedule = seedPlayoffs(league);
    const seeding = schedule.playoffSeeding!;
    expect(doublesTeams(seeding)[0]).toEqual({ a: 'A1', b: 'B8' });
    expect(doublesTeams(seeding)[7]).toEqual({ a: 'A8', b: 'B1' });
    expect(singlesGroupIds(seeding, 'A-Top')).toEqual(['A1', 'A2', 'A3', 'A4']);
    expect(singlesGroupIds(seeding, 'B-Bottom')).toEqual(['B5', 'B6', 'B7', 'B8']);

    const doubles = schedule.weeks[14];
    expect(doubles.games).toHaveLength(2 * 4);
    const singles = schedule.weeks[15];
    expect(singles.games).toHaveLength(4 * 6);
    for (const g of singles.games) {
      if (g.kind !== 'singles') throw new Error('expected singles');
      const group = singlesGroupIds(seeding, g.group);
      expect(group).toContain(g.players[0]);
      expect(group).toContain(g.players[1]);
    }
    expect(doublesStandings({ ...league, schedule })).toHaveLength(8);
  });
});
