import type { History } from './types';

export function emptyHistory(): History {
  return { about: '', timeline: [], champions: [], founders: [], presidents: [] };
}

export function newHistoryId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Award names from the rule sheet, offered as suggestions when recording a champion. */
export const AWARD_SUGGESTIONS = [
  'A Division Champion',
  'B Division Champion',
  'A Most Improved',
  'B Most Improved',
  'Play-off Doubles Champions',
  'Singles Champion – Top A',
  'Singles Champion – Bottom A',
  'Singles Champion – Top B',
  'Singles Champion – Bottom B',
];

/** The first four-digit year in the text, or null when there isn't one. */
export function yearOf(text: string): number | null {
  const m = /\b(\d{4})\b/.exec(text);
  return m ? Number(m[1]) : null;
}

/**
 * Sorts entries by year (oldest first, or newest first with `newestFirst`),
 * keeping entry order within a year. Entries without a year go last.
 */
export function byYear<T extends { year: string }>(items: T[], newestFirst = false): T[] {
  return items
    .map((item, i) => ({ item, i, y: yearOf(item.year) }))
    .sort((x, z) => {
      if (x.y === null || z.y === null) return x.y === z.y ? x.i - z.i : x.y === null ? 1 : -1;
      return (newestFirst ? z.y - x.y : x.y - z.y) || x.i - z.i;
    })
    .map((e) => e.item);
}
