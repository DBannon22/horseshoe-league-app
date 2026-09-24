# Horseshoe League Manager

A web app for running a 16-player horseshoe league (8 A-side, 8 B-side players):
roster, a 16-week schedule, score entry, standings and playoffs.

Live site: https://dbannon22.github.io/horseshoe-league-app/

## Running it

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm test           # scheduler / standings / playoff tests
```

Pushing to `main` runs the tests and redeploys GitHub Pages automatically.

To develop against local Firebase emulators instead of the real project, run
`firebase emulators:start --only auth,firestore --project demo-horseshoe`, then
`VITE_FIREBASE_EMULATOR=true npm run dev`.

## Logins

With Firebase connected (see setup below), the league is stored online and is
**members only** — it holds players' and spares' contact details:

- **Members** sign in with the shared league login to view the schedule, scores,
  standings, playoffs, roster and spares, and see updates live. Each device stays
  signed in.
- **Admins** sign in with their own login to enter scores, generate or change the
  schedule, edit the roster and spares, seed the playoffs, and use Settings.
- Signed-out visitors only see the sign-in screen. This is enforced by
  `firestore.rules` on the server, not just by hiding the pages.

Until `src/firebaseConfig.ts` is filled in, the app runs in **local mode**: there is no
login, and data is kept only in the browser that entered it.

### Admin login setup (one time, about 10 minutes)

1. Go to https://console.firebase.google.com, click **Create a project**, and name it
   (for example `horseshoe-league`). Google Analytics can be turned off.
2. **Build → Authentication → Get started.** Under **Sign-in method**, enable
   **Email/Password**.
   - **Users → Add user**: enter the admin's email and a password. Copy the
     **User UID** shown in the list.
   - **Settings → Authorized domains → Add domain**: `dbannon22.github.io`
   - Recommended: **Settings → User actions**, untick **Enable create (sign-up)** so
     only you can add accounts.
3. **Build → Firestore Database → Create database** (production mode, any nearby
   location).
   - **Rules** tab: replace everything with the contents of `firestore.rules` and click
     **Publish**.
   - **Data** tab: **Start collection** named `admins`. Use the admin's **User UID** as
     the *Document ID*, add any field (for example `name` = `League admin`), and save.
     Repeat for each extra admin.
   - For the shared member login: in **Authentication → Users → Add user**, create one
     account (for example `members@horseshoe-league.app` — it doesn't need to be a real
     inbox) with the password you'll give players. Then in **Firestore → Data**, start a
     collection named `members` with that account's **User UID** as the *Document ID*.
4. **Project settings (gear icon) → General → Your apps → Web (`</>`)**. Register the
   app (Firebase Hosting isn't needed) and copy the `firebaseConfig` values into
   `src/firebaseConfig.ts`. These values are not secret.
5. Commit and push. After the site redeploys, open it, click **Admin login**, sign in,
   and choose **Start a new league** (or use **Settings → Import backup** to bring in
   an exported league).

To remove an admin, delete their document under `admins` (and optionally the user
under Authentication). To change the member password, open the member account under
**Authentication → Users** and reset it; players then sign in again with the new one.

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
score wins. The **Win** button next to each score fills in the winning score (35 by
default, set in Settings) and jumps to the other team, so only the losing score is typed.
Regular-season games where neither team reached 35 are flagged. Horseshoes has no ties,
so a game with even scores is flagged and not counted until it is corrected. Each player is credited
with their team's score and result, so individual standings add up the team scores from
every game they played. Standings rank by total
points, points per game, or wins (Settings), with the other two as tie-breakers.

## How the schedule is built

`src/lib/scheduler.ts`: stationary pairs come from a round robin. Each night starts
from a template where no rotating player repeats a court or opponent, then simulated
annealing (using only moves that keep those rules) balances season-long partner and
opponent counts. Generation is seeded, so a schedule can be reproduced from its number.
