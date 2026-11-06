# Lift Board backend plan (Vercel) · draft

## Shape
- **App:** keep the current Vite front end; host on Vercel. Add `/api/*` as Vercel Functions (or move to Next.js App Router if you want server-rendered pages later).
- **Database:** Postgres (Neon, from the Vercel Marketplace). Schema draft: `backend/schema.prisma`.
- **Auth:** email magic link (Auth.js or Clerk). No passwords to store or reset.
- **Rules stay on the phone.** `src/engine.js` has no DOM code; it runs on the device for instant, offline planning. The server stores inputs and logs only. If you ever compute on the server, import the same `engine.js` so both sides agree.

## Sync model (offline first)
1. Phone keeps working from local storage exactly as today.
2. Every write gets a `clientId` and `updatedAt` and goes in an outbox.
3. `POST /api/sync` sends the outbox, receives everything changed since `lastSyncAt`. Last write wins per record (per set, per check-in field).
4. On a new phone: sign in → `GET /api/bootstrap` → rebuild local state.

## Endpoints
| Route | Does |
|---|---|
| `POST /api/auth/*` | magic link sign-in |
| `GET /api/bootstrap` | profile, settings, current week, last 12 weeks, set logs (last 6 months), notes, custom exercises |
| `POST /api/sync` | push outbox, pull changes since a timestamp |
| `POST /api/weeks/close` | close the week (snapshot + calibration inputs) |
| `GET /api/export` | everything as JSON (privacy: right to a copy) |
| `DELETE /api/account` | delete everything (privacy: right to erase) |

## Migration from today's local storage
- `wk` → Profile + Settings + current Week.check-in + Week.snapshot history (`wk.weeks`).
- `slots` → PlannedDay + Slot + SetLog for the current week.
- `exHist` → SetLog rows (top set per session; older detail isn't kept today).
- `wk.sessions` → ActivitySession rows (lift sessions are derivable from SetLog).
- `wk.next` → NextNote.
- Exercise names → Exercise ids via a slug table; unknown custom names become owner-scoped Exercise rows.
- Ship it as a one-time "Upload my data" step after sign-in, reusing the backup file format.

## Before friends use it
- Privacy policy + consent screen (weight, body fat and cycle notes are health data).
- Export + delete working.
- Error states: offline banner, sync failed, signed out.
- Usage events (day done, exercise swapped, set skipped, tour finished) to learn from testers.
- Push notifications for the rest timer need a service worker + web push (iPhone: only when installed to the home screen).
