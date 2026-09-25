import { describe, expect, test } from 'vitest';
import { generateSchedule } from './scheduler';
import { fairnessReport, range } from './fairness';
import { defaultLeague, migrateLeague } from './storage';
import { roundRobin } from './roundRobin';
import { formatPhone, parseSpares, telHref } from './spares';
import { boldParts, defaultRules, ruleBlocks } from './rules';
import { doublesStandings, doublesTeams, seedPlayoffs, singlesGroupIds } from './playoffs';
import { outcome, playerStats, sideStandings } from './standings';
import { isRegular, type DoublesGame, type League, type Score, type Team } from './types';

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
  // Deterministic fake team scores: lower roster slots make stronger teams, and the
  // formula never gives two teams the same score (horseshoes has no ties).
  // With 4 games a night everyone partners everyone equally, so A1 and B1 finish on top.
  const league: League = { ...defaultLeague(), schedule: generateSchedule(players, '2026-10-01', 4, 3) };
  const slot = (id: string) => Number(id.slice(1));
  const teamScore = (t: Team) => 400 - 10 * (slot(t.a) + slot(t.b)) - slot(t.a);
  for (const week of league.schedule!.weeks)
    for (const g of week.games) {
      if (g.kind !== 'doubles') continue;
      g.score = [teamScore(g.teams[0]), teamScore(g.teams[1])];
    }

  test('outcome picks the higher team score', () => {
    const o = outcome({
      id: 'x',
      kind: 'doubles',
      round: 1,
      court: 1,
      teams: [
        { a: 'A1', b: 'B1' },
        { a: 'A2', b: 'B2' },
      ],
      score: [15, 14],
    });
    expect(o).toEqual({ complete: true, even: false, totals: [15, 14], winner: 0 });
  });

  test('even scores are not counted, since horseshoes has no ties', () => {
    const game = {
      id: 'x',
      kind: 'doubles' as const,
      round: 1,
      court: 1,
      teams: [
        { a: 'A1', b: 'B1' },
        { a: 'A2', b: 'B2' },
      ] as [Team, Team],
      score: [20, 20] as Score,
    };
    expect(outcome(game)).toMatchObject({ complete: false, even: true, winner: null });
    expect(playerStats([game], ['A1']).map((st) => st.gp)).toEqual([0]);
  });

  test('each partner is credited with the team score', () => {
    const game = {
      id: 'x',
      kind: 'doubles' as const,
      round: 1,
      court: 1,
      teams: [
        { a: 'A1', b: 'B1' },
        { a: 'A2', b: 'B2' },
      ] as [Team, Team],
      score: [21, 17] as Score,
    };
    const [a1, b1, a2] = playerStats([game], ['A1', 'B1', 'A2']);
    expect([a1.pts, a1.w, b1.pts, b1.w, a2.pts, a2.l]).toEqual([21, 1, 21, 1, 17, 1]);
  });

  test('old per-player scores are merged into team scores', () => {
    const old = structuredClone(league);
    const g = old.schedule!.weeks[0].games[0] as DoublesGame & { scores?: Record<string, number> };
    const [t0, t1] = g.teams;
    delete (g as Partial<DoublesGame>).score;
    g.scores = { [t0.a]: 12, [t0.b]: 9, [t1.a]: 7 };
    const migrated = migrateLeague(old).schedule!.weeks[0].games[0];
    expect(migrated.score).toEqual([21, null]);
    expect('scores' in migrated).toBe(false);
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
    expect(doubles.games).toHaveLength(4 * 4);
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

describe('winning score setting', () => {
  test('defaults to 35 and is added to older saved leagues', () => {
    expect(defaultLeague().settings.winningScore).toBe(35);
    const old = defaultLeague();
    delete (old.settings as Partial<typeof old.settings>).winningScore;
    expect(migrateLeague(old).settings.winningScore).toBe(35);
  });
});

describe('spares', () => {
  test('parses a pasted list in several phone formats', () => {
    const text = [
      'Pat Smith          519.555.0100',
      '  Jo  Ann Lee 905-555-0199',
      'Sam Brown, (226) 555 0123',
      'No Number Nelson',
      '',
    ].join('\n');
    expect(parseSpares(text)).toEqual([
      { name: 'Pat Smith', phone: '519.555.0100' },
      { name: 'Jo Ann Lee', phone: '905-555-0199' },
      { name: 'Sam Brown', phone: '(226) 555 0123' },
      { name: 'No Number Nelson', phone: '' },
    ]);
  });

  test('formats numbers and builds call links', () => {
    expect(formatPhone('519.555.0100')).toBe('519-555-0100');
    expect(formatPhone('+1 (226) 555-0123')).toBe('226-555-0123');
    expect(telHref('519.555.0100')).toBe('tel:5195550100');
  });

  test('older saved leagues get an empty spares list', () => {
    const old = defaultLeague();
    delete (old as Partial<League>).spares;
    expect(migrateLeague(old).spares).toEqual([]);
  });
});

describe('rules', () => {
  test('older saved leagues get the printed rules', () => {
    const old = defaultLeague();
    delete (old as Partial<League>).rules;
    const rules = migrateLeague(old).rules;
    expect(rules.map((s) => s.title)).toEqual(defaultRules().map((s) => s.title));
    expect(rules[0].rules).toHaveLength(9);
  });

  test('edited rules are kept and defaults are fresh copies', () => {
    const league = defaultLeague();
    league.rules = [{ title: 'House rules', rules: ['Be nice.'] }];
    expect(migrateLeague(league).rules).toEqual([{ title: 'House rules', rules: ['Be nice.'] }]);
    defaultRules()[0].rules.push('changed');
    expect(defaultRules()[0].rules).toHaveLength(9);
  });

  test('formats bullets and bold text', () => {
    expect(ruleBlocks('Nights:\n- One\n- Two\n\nAfter')).toEqual([
      { kind: 'text', text: 'Nights:' },
      { kind: 'bullets', items: ['One', 'Two'] },
      { kind: 'text', text: 'After' },
    ]);
    expect(boldParts('A **ringer** counts 3')).toEqual(['A ', 'ringer', ' counts 3']);
  });
});
