# Horseshoe League Manager

A web app for running a 16-player horseshoe league (8 A-side, 8 B-side players):
roster, a 16-week schedule, score entry, standings and playoffs.

## Running it

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ — host anywhere (it is fully client-side)
npm test           # scheduler / standings / playoff tests
```

Data is saved in the browser's local storage. Use **Settings → Export backup** to
keep a copy or move the league to another computer.

## Season format

| Weeks | Format |
|-------|--------|
| 1–7   | A side stays: each week the A players are paired by round robin (every A plays every other A once) and each A pair keeps one court all night. B players rotate courts and partner an A player each game. |
| 8–14  | B side stays, A side rotates — same structure with the sides swapped. |
| 15    | Playoff doubles: A1 + B8, A2 + B7 … A8 + B1, seeded from regular-season standings. |
| 16    | Playoff singles: A top four, A bottom four, B top four, B bottom four — each group plays a round robin and keeps its own totals. |

Games per night (1–4) is chosen when generating. With 4, each rotating player visits
every court once a night, and the season comes out perfectly even: every A–B pair
partners 7 times and opposes 7 times, and every same-side pair faces each other 8
times.

## Scoring

Enter one score per team for each game (one per player in playoff singles); the higher
score wins. Each player is credited with their team's score and result, so individual
standings add up the team scores from every game they played. Standings rank by total
points, points per game, or wins (Settings), with the other two as tie-breakers.

## How the schedule is built

`src/lib/scheduler.ts`: stationary pairs come from a round robin. Each night starts
from a template where no rotating player repeats a court or opponent, then simulated
annealing (using only moves that keep those rules) balances season-long partner and
opponent counts. Generation is seeded, so a schedule can be reproduced from its number.
