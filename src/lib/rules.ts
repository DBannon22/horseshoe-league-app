import type { RuleSection } from './types';

/** Transcribed from the league's printed rule sheet (revised September 1998). */
const PRINTED_RULES: RuleSection[] = [
  {
    title: 'General Rules of Play',
    rules: [
      'The standard throwing distance of 40 (forty) feet will be used. However, ladies and those with physical difficulties will be allowed to throw from 30 (thirty) feet.',
      'Starting player of the first game will be determined by a horseshoe call and flip. Thereafter, the winner of the previous game will begin the new game.',
      'Players must use the same shoes through a complete game, which will consist of 35 (thirty-five) points.',
      'The counting team will always throw first during a game. If an end results in no scoring, the last non-scoring team will throw first (“lose the hammer”).',
      'Players are responsible for securing spares when absence is unavoidable. If your spare does not show up, your score will be the average of your previous three nights’ total.',
      'The concept of “fair play” and good sportsmanship will be observed at all times. Heckling your opponent is not the way to win a game!',
      '“Woody shoes” or shoes which land initially in front of the pit will be considered foul shoes, and may not be re-thrown. A thrown shoe which hits the backboard before landing in the pit is also a foul shoe and may not be re-thrown. Foul shoes, if in the pit, must be removed before the next shoe is thrown.',
      'Players may throw from either side of the stake.',
      'A league season will consist of 7 (seven) games based on an “A” player schedule, and 7 (seven) games played on a “B” player schedule.',
    ],
  },
  {
    title: 'Scoring',
    rules: [
      'A point cancellation format will be used.',
      'A **point** is scored when a shoe is touched or moved by another shoe securely toed to the stake. A **leaner**, which must touch the stake, takes precedence over a buried shoe, even if the buried shoe is touching the stake. A **leaner** shall count 1 (one) point.',
      'A **ringer** is scored when a shoe is far enough on the stake to let a straight edge touch both toes of the shoe at the same time. A **ringer** shall count 3 (three) points.',
      'At the conclusion of play, shoes should not be touched or moved until the counting is agreed upon by all players.',
      'All players should closely follow the scoring. Disputes will not be heard after the first shoe has been thrown in the next inning.',
    ],
  },
  {
    title: 'Play-offs',
    rules: [
      'To be eligible for awards, a player must have played 10 (ten) of the fourteen games in the regular season. Exceptions to this rule will be governed by the executive.',
      [
        'Play-offs will take place over three nights at the conclusion of the regular schedule, as follows:',
        '- **First night** – first four games of doubles schedule',
        '- **Second night** – last three games of doubles schedule',
        '- **Third night** – Singles competition',
      ].join('\n'),
      'Spares will not be allowed in play-off competitions, unless extenuating circumstances exist. In that event, the eligibility of the spare player will be made by the league executive.',
    ],
  },
  {
    title: 'Regular Season Awards',
    rules: [
      [
        'Prizes will be awarded in each division (A and B) as follows:',
        '- **Division Champion** – based on highest aggregate score during regular season play. In the event of a tie, the winner will be decided by the number of games won. If a tie still exists, a winner will be decided on the basis of aggregate scores in games lost.',
        '- **Most Improved** – based on improvement from the conclusion of the first half of the season’s play to the conclusion of the last half. The winner will be determined by the highest improvement in average game score. In the event of a tie, winner will be determined by the highest number of games won during the last half of the season’s play. If a tie still exists, a winner will be decided on the basis of aggregate scores in games lost.',
      ].join('\n'),
      'If the Division Champion is also the Most Improved winner, the Most Improved award shall revert to the second Most Improved player.',
    ],
  },
  {
    title: 'Play-off Doubles Award',
    rules: [
      'A “Round Robin” tournament will be set up, with teams determined as follows: Team #1 – Highest A and Lowest B; Team #2 – 2nd highest A and second lowest B; Team #3 – 3rd highest A and third lowest B; etc.',
      'Prizes will be awarded to the Doubles Champions based on the highest number of games won. In the event of a tie, a total of the aggregate losing scores will decide the winner. If a tie still exists, a play-off game to 35 will decide the winner.',
      'Shoes for the games will be provided by the “A” player of each team, unless both players agree to use the “B” player’s shoes.',
      'The principle of reversion shall not apply in the awarding of the Play-off Doubles award.',
    ],
  },
  {
    title: 'Play-off Singles Awards',
    rules: [
      'Using aggregate scores from the regular season’s play, the league will be divided into 4 (four) divisions, as follows: (a) Top four “A” players, (b) Bottom 4 “A” players, (c) Top four “B” players, (d) Bottom 4 “B” players.',
      'The following play schedule will be used: Game 1 – 1 vs. 2, 3 vs. 4; Game 2 – 4 vs. 1, 2 vs. 3; Game 3 – 3 vs. 1, 4 vs. 2.',
      'Each Singles division will be assigned a pitch, upon which all games are to be played.',
      'A no-walking format is preferred, unless walking between ends is agreed upon by all four players concerned.',
      [
        '(a) Shoe choice will be made by the player with the highest aggregate season score. If the four players agree to use a walking format, each player will throw his or her own shoes.',
        '(b) In no-walking format, the end choice belongs to the player with the lowest aggregate season score.',
      ].join('\n'),
      'All games will begin at the southern end of the court, and start shoes will be determined by a horseshoe call and flip.',
      'A game will conclude when one player reaches 40 points, or 40 shoes have been thrown by all players concerned. Normal score cancelling will not be in effect, and scores will be determined after all shoes have been thrown in each end.',
      'Scores will be recorded after each end on the official score sheet, provided by the National Horseshoe Pitchers Association of America. The throwing percentage (number of ringers divided by number of shoes thrown × 100) of each player will be determined from these completed score sheets.',
      'A winner in each of the four divisions will be declared, based upon games won. If a tie results, the winner will be determined by the highest aggregate losing scores in the Singles competition. If a tie still exists, the highest ringer percentage shall be declared the winner.',
      'If a Singles winner has already received an award as Division Champion, as Most Improved player during season play, or as a Play-off doubles champion, the Play-off singles award will be given to the second place player in the division. Therefore, this award may even be awarded to the fourth place player in a division.',
    ],
  },
];

/** A fresh copy of the printed rules, safe to edit. */
export function defaultRules(): RuleSection[] {
  return PRINTED_RULES.map((s) => ({ title: s.title, rules: [...s.rules] }));
}

export type RuleBlock = { kind: 'text'; text: string } | { kind: 'bullets'; items: string[] };

/** Splits a rule into paragraphs and bullet lists (consecutive lines starting with “- ”). */
export function ruleBlocks(rule: string): RuleBlock[] {
  const blocks: RuleBlock[] = [];
  for (const raw of rule.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-•]\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.kind === 'bullets') last.items.push(bullet[1]);
      else blocks.push({ kind: 'bullets', items: [bullet[1]] });
    } else blocks.push({ kind: 'text', text: line });
  }
  return blocks;
}

/** Splits text on `**bold**` markers; odd-indexed pieces are bold. */
export function boldParts(text: string): string[] {
  return text.split(/\*\*(.+?)\*\*/g);
}
