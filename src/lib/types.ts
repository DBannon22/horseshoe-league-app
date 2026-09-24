export const SIDE_SIZE = 8;
export const COURTS = SIDE_SIZE / 2;
export const PHASE_WEEKS = SIDE_SIZE - 1;
export const REGULAR_WEEKS = PHASE_WEEKS * 2;
export const TOTAL_WEEKS = REGULAR_WEEKS + 2;

export type Side = 'A' | 'B';

export interface Player {
  id: string;
  name: string;
  side: Side;
  /** Roster slot 1–8 within the side. Identity only — seeding comes from standings. */
  slot: number;
}

/** A doubles team is always one A-side player and one B-side player. */
export interface Team {
  a: string;
  b: string;
}

export type Phase = 'A_STAYS' | 'B_STAYS' | 'PLAYOFF_DOUBLES' | 'PLAYOFF_SINGLES';

/** One score per side of the game (team in doubles, player in singles); null = not yet scored. */
export type Score = [number | null, number | null];

export interface DoublesGame {
  id: string;
  kind: 'doubles';
  round: number;
  court: number;
  teams: [Team, Team];
  score: Score;
}

export type SinglesGroup = 'A-Top' | 'A-Bottom' | 'B-Top' | 'B-Bottom';

export interface SinglesGame {
  id: string;
  kind: 'singles';
  round: number;
  court: number;
  group: SinglesGroup;
  players: [string, string];
  score: Score;
}

export type Game = DoublesGame | SinglesGame;

export interface Week {
  number: number;
  date: string; // YYYY-MM-DD
  phase: Phase;
  games: Game[];
}

export interface PlayoffSeeding {
  /** Player ids in seed order, best first. */
  A: string[];
  B: string[];
  seededAt: string;
}

export interface Schedule {
  startDate: string;
  seed: number;
  gamesPerNight: number;
  generatedAt: string;
  weeks: Week[];
  playoffSeeding: PlayoffSeeding | null;
}

export type RankBy = 'points' | 'average' | 'wins';

export interface Settings {
  leagueName: string;
  gamesPerNight: number;
  rankBy: RankBy;
}

export interface League {
  version: 1;
  players: Player[];
  settings: Settings;
  schedule: Schedule | null;
}

export const PHASE_LABEL: Record<Phase, string> = {
  A_STAYS: 'A side stays · B side rotates',
  B_STAYS: 'B side stays · A side rotates',
  PLAYOFF_DOUBLES: 'Playoffs · Doubles',
  PLAYOFF_SINGLES: 'Playoffs · Singles',
};

export function isRegular(phase: Phase): boolean {
  return phase === 'A_STAYS' || phase === 'B_STAYS';
}

export function sideIds(players: Player[], side: Side): string[] {
  return players
    .filter((p) => p.side === side)
    .sort((x, y) => x.slot - y.slot)
    .map((p) => p.id);
}
