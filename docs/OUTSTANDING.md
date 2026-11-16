# Outstanding work

What's left, in the order to do it. Read `docs/CONTEXT.md` first for the reasoning behind the product. Specs live in the handoff docs; this file says what's done, what to check and what's next.

Updated Nov 16, 2026, from a search of the code at commit `7cd4ab3`. A code search shows something exists, not that it works on a phone, so the "check on the phone" items matter.

**When you finish an item:** tick it here, note the commit, and list any web changes it needs.

---

## Status of the handoff sections

| Section | What | Native | Web |
| --- | --- | --- | --- |
| Handoff Nov 13 §1–5 | Onboarding and pace, weekly report, History weeks and lifts, small changes | Built | Built |
| §4 | Playlist workout (experiment) | Not built; **waiting on Emma** (see C3) | Board only |
| §6 | Day pager | Built | Built |
| §7–8 | Polish passes, tips, first-run tab tips | Built | Built |
| §9 | Headers hide on scroll | Built | Built |
| §10 | History → Lifts rows | Built | Built |
| §11 | App icon and animated splash | Built | Built |
| §12 | Titles, next-time lines, share card | Built; **check next-time format** (A2) | Built |
| §13–18 | Date line, activity logging, Changes/Watch, pressed states, workout fixes, Today button | Built | Built where it applies |
| §19 | Profile and Settings split | Built; **check on phone** (A3) | Built |
| §20 | Fixes from using the dev app | Built in `55e5303`; **check on phone** (A1) | Built where marked "Web too"; check A5 |
| §21 | Records on the Day done card | **Not built** (B1) | Built |
| Alerts and haptics Part 1, 3 | Rest alerts, sounds, haptics | Built | n/a |
| Alerts and haptics Part 2 | Live Activity (Lock Screen and Dynamic Island) | **Not built** (B3) | n/a |
| Liquid Glass audit 1–6 | Bottom accessory, zoom, form sheets, rest bar, tab bar minimise | Built (6 dropped) | n/a |
| Liquid Glass audit 7–9 | Prominent glass buttons, long-press menus, floating date line | Not built; "worth trying", **waiting on Emma** | n/a |
| START-HERE | Import a web backup | **Not built** (B2) | n/a |
| Backend | Supabase sign-in and sync | Not started; after Emma has used the app for a week (B4) | n/a |

---

## A. Check on the phone first

These exist in code but haven't been confirmed working. Go through them with Emma on a real phone, fix what's off, then move on.

**A1. Section 20 fixes.** Run each item's test case on the phone:
- An unstarted cardio finisher has no check.
- The rest timer reads Done at zero and stops.
- "Added (Main Glute)" and "Day 4: Push" have no bullets.
- You can swipe to delete a set and an exercise, and Undo works.
- Marking Rough mid-workout keeps finished exercises and their sets.
- Opening a second workout from Plan doesn't make it live. The live pill goes away when the workout ends, and long-press offers End workout.
- The rest bar appears without a stutter, with its text centred in the glass.
- Content scrolls under the status bar on every tab.
- Keep on the weight suggestion is remembered when you leave and reopen the workout.
- The sets picker is green.
- Workouts and Plan → Week update straight away after finishing a workout and after marking a week done.
- Supersets and lower-body focus don't repeat in the next week's changes.
- Sports can be picked in Settings → Activities.
- The first lift of a new week can be swapped with any other unstarted lift that week.
- The notification icon is the new one. This needs a fresh dev build: `npx expo prebuild --clean`, then build again.

**A2. Next-time line format.** Section 12 says next-time lines read **Overhead Press (Barbell): 30lb x 8**, but `copy.ts` still has `nextLine: "· {…} lb · {…}"`. Find where next-time lines render (workout screen, Day done, review) and make sure every one uses the section 12 format, then remove the unused copy key.

**A3. Profile and Settings (section 19).** Compare with `docs/design/Proto_Profile.dc.html`, `Proto_ProfileNew.dc.html` and `Proto_Settings.dc.html`:
- The streak number is the same height as the flame.
- Missed weeks in the 12-flame row are faint, not missing.
- The card warms up with the streak and has the shine.
- First-week states show (fresh install or Reset profile).
- "Same weight" shows when the strongest lift hasn't gone up.

**A4. Weekly report streak.** Section 19 lists "{n} weeks in a row" on the weekly report as a later item. `week-report.tsx` has a `streak` field; confirm whether it shows. If not, leave it for Emma to decide.

**A5. Web parity for section 20.** The web app has Delete buttons rather than swipe. Check every item marked "Web too" in section 20 behaves the same on the web (`src/main.js`), especially A7 Rough, A11 Keep, B3 changes and B5 swap.

---

## B. Build next

**B1. Records on the Day done card** (handoff section 21). Match the web: `prHighlight()` and `todayPRs()` in `src/main.js`, styles `.dpr`. Use `prsBetween` from `packages/engine` and port the test "a heavier top set today shows as a record for the Day done card". Add a success haptic when the card opens with a record. The share card's PRs tile must use the same list.

**B2. Import a web backup.** Needed before friends move from the web app to TestFlight. Spec in `docs/SCREENS.md` section 8 and `docs/BACKEND-SUPABASE.md`. Add a test with a sample backup that checks the Lifts, Activities and Weeks active counts after import. Until the backend exists, there's no sign-in. Put it in Settings → Your data, and skip the upload steps: read the backup file, write it to storage, call `init(storage)`.

**B3. Live Activity** (`docs/HANDOFF-alerts-haptics.md` Part 2). Rest countdown and current exercise on the Lock Screen and Dynamic Island while a workout is live. Ends when the workout ends, the same as the live pill.

**B4. Beta readiness** (before TestFlight):
- Apple Developer enrollment.
- EAS Build and Submit set up.
- Bundle id and version.
- An App Store privacy label. The app stores health data on the device only, with no tracking.
- A short privacy policy page.
- Crash reporting with health data scrubbed (no weights, body stats or notes in reports).
- The "not medical advice" line visible in Settings.

**B5. Backend** (`docs/BACKEND-SUPABASE.md`). Only after Emma has used the native app for a week. Covers email code sign-in, row-level security, the sync outbox and the two Edge Functions.

---

## C. Waiting on Emma (don't build yet)

These have been discussed but not decided. Ask her before starting any of them.

**C1. Sheet styles.** One summary card uses the native glass sheet and others don't. The proposed rule:
- Small glass sheets for swap, the weight suggestion, activity details and confirmations.
- A large glass sheet that opens nearly full for the weekly report.
- Solid full screen for Day done.
- Solid cards inside every sheet, and a solid share card.

Emma hasn't confirmed which card she saw or agreed to the groups.

**C2. Upper and lower strength trend on History → Lifts.** The proposed formula:
- Each exercise's estimated 1RM, as a percentage of its own first-3-session baseline.
- Averaged per half, weighted by sets.
- Smoothed over 3 weeks, taking the best session in each week.
- Labelled Up (above +2%), Holding (within ±2%) or Down (below −2%).
- Down only shows after 2 weeks in a row below the band.
- Holding shows in green on a cut.
- Nothing shows before 3 weeks of data.

Waiting on Emma: whether to show percentages, and whether core and carries count. The plan is to check the formula against her real logs before designing the card.

**C3. Playlist workout** (handoff section 4, board `docs/design/Proto_Playlist.dc.html`). An experiment, not yet built. Ask whether it's still wanted.

**C4. Liquid Glass audit items 7–9.** "Worth trying" ideas: prominent glass Start and Log set buttons, long-press menus on day cards, a floating date line. Try them only if asked.

**C5. The You tab's first-run tip** still says the tab is for tips, experience level and FAQs, which now live in Settings. It's Emma's wording; ask her for new copy rather than changing it.

---

## Keep the docs current

When something ships or a decision changes, update in the same commit:
- this file;
- `docs/SCREENS.md` and `docs/COPY.md`, for screens and words;
- `docs/LOGIC.md` and both engines' tests, for rules;
- `docs/CONTEXT.md`, when a product decision changes or something is decided against.
