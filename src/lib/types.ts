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
  /** Points that win a game (the “Win” button fills this in). */
  winningScore: number;
}

export const DEFAULT_WINNING_SCORE = 35;

/** A fill-in player who can be called when a rostered player can't make it. */
export interface Spare {
  id: string;
  name: string;
  phone: string;
}

/** A titled group of numbered league rules, shown on the Rules page. */
export interface RuleSection {
  title: string;
  /** Plain text; `**bold**` and lines starting with “- ” (bullets) are formatted. */
  rules: string[];
}

/** A dated moment in the league's story. `year` is free text, e.g. “1998” or “Fall 2004”. */
export interface TimelineEvent {
  id: string;
  year: string;
  text: string;
}

export interface Champion {
  id: string;
  year: string;
  award: string;
  /** One name, or both partners for a doubles title. */
  winner: string;
}

export interface FoundingMember {
  id: string;
  name: string;
  note: string;
}

export interface President {
  id: string;
  /** Term, e.g. “1998–2003”; sorted by its first year. */
  year: string;
  name: string;
}

export interface History {
  /** A short blurb about the league, shown at the top of the History page. */
  about: string;
  timeline: TimelineEvent[];
  champions: Champion[];
  founders: FoundingMember[];
  presidents: President[];
}

export interface League {
  version: 1;
  players: Player[];
  settings: Settings;
  schedule: Schedule | null;
  spares: Spare[];
  rules: RuleSection[];
  history: History;
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
