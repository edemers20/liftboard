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
| Liquid Glass audit 1–6 | Bottom accessory, zoom, form sheets, rest bar, tab bar minimise | Built (6 dropped); the bottom accessory isn't wired, the live pill is a dock above the tab bar | n/a |
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
  - Fixed Nov 16: Start workout crashed the dev app ("GestureDetector must be used as a descendant of GestureHandlerRootView"). The root layout now wraps the app in `GestureHandlerRootView`; JS only, no native rebuild. A release build would not crash, but swipe would not work.
  - Fixed Nov 16 (phone test on e070d5f): Delete showed behind rows that weren't swiped, and delete sometimes did nothing. Delete now stays hidden until the row moves, uses a gesture-handler button so the swipe can't swallow the tap, and closes the row first. Rows get new keys after a delete or Undo, so no row inherits another's open swipe. Empty planned sets have no swipe, because deleting one changed nothing (the planned count refills the row); a set with anything entered, or one added past the plan, can be deleted.
  - Fixed Nov 16 (Emma's build check): the swipe could stick part-open with Delete showing. The library swipeable only settled when a gesture ended normally, so a swipe cut short by the list scrolling or the system left it where it was. Swipe delete now uses its own pan: every end or cancel settles fully closed or fully open (`src/swipe-settle.ts`, unit-tested over every position and speed), vertical drags go to the list, one row is open at a time, and a touch anywhere but Delete or a scroll closes it. Deleted or restored rows come back closed.
  - Fixed Nov 16 (crash on the first swipe after `fb367c2`, Mac console: "ReferenceError: Property 'SWIPE_WIDTH' doesn't exist" on the UI thread): `swipeDrag` and `swipeSettle` defaulted `width = SWIPE_WIDTH`. A worklet's captured values are unpacked inside its body, after default parameters run, so the default read a name the UI thread didn't have yet. The width is now read in the body. `src/worklets-ui-thread.test.ts` compiles every worklet with the worklets plugin, fails if a parameter reads a captured name, and runs the swipe worklets in a fresh context the way the UI thread does. JS only; no rebuild. Web: n/a.
  - Built Nov 16 (Emma, after the swipe fix): a full swipe deletes, iOS Mail style. A partial swipe still settles open on Delete or closed; dragging on past the full-swipe point (over half the row and at least twice the button) grows the red area, gives a medium tap as it arms (a light one if you pull back), and letting go there slides the row off and deletes it with the same Undo. Only position decides a full swipe; a fast flick from closed only opens. `swipeFullAt`, `swipeDrag` and `swipeSettle` take the row width; `src/swipe-settle.test.ts` and `src/worklets-ui-thread.test.ts` cover it. JS only; no rebuild. Web: n/a (Delete buttons).
  - Undo toast (Emma, Nov 16): "Deleted" on the left and "Undo" as its own button on the right, no dot between them (`copy.workout.deleted`, `undoDelete`; `deletedUndo` removed). Web: the same toast.
  - Fixed Nov 16: the Expo web preview threw "isReduceTransparencyEnabled is not a function" on load (React Native Web doesn't have it). `useSolidGlass` and `useSolidLive` now ask only on iOS.
  - Built Nov 16 (Emma): empty sets are deletable. Deleting a planned set lowers this workout's count for that exercise so the plan can't refill it (`st.drop`); Undo restores it; the saved program and later weeks don't change. Deleting the last row removes the exercise (with Undo). Engine tests cover it.
  - Web: done Nov 16. Every set row's Delete works on empty planned sets too: a planned row raises `st.drop` (taken off in `src/engine.js` `plan()`, never below the ticked sets, cleared at a new week for finished days), a row past the plan is just removed, the last row removes the exercise, and Undo restores it. Swipe is native only.
- Marking Rough mid-workout keeps finished exercises and their sets.
- Opening a second workout from Plan doesn't make it live. The live pill goes away when the workout ends, and long-press offers End workout.
  - Fixed Nov 16 (phone test on e070d5f): the live pill never showed. React Compiler cached the live workout read on the clock only, and the engine changes `wk` in place, so starting a workout or ticking a set never reached the pill while the tabs stayed mounted. `useLiveWorkout` now opts out (`"use no memo"`), the same as the tab screens; `src/engine-readers-compiler.test.ts` runs the compiler and fails if it is memoized again. The pill is the green dock above the tab bar on every tab; the system bottom accessory (`LiveWorkoutAccessory`) is built but not wired. Web: none (no live pill on the web). Check on the phone: start a workout, go back; the pill shows on all four tabs, tracks sets and rest, and long-press offers End workout.
  - Stale values audit (Emma, Nov 16), fixed: React Compiler cached engine reads all over the app, because the engine changes `wk` in place. Every file that reaches the engine (33, found from the imports) now opts out at the top (`"use no memo"`), and `src/engine-readers-compiler.test.ts` compiles them all and fails if any is memoized again or a screen root stops subscribing to the store. What was stale:
    - History: the whole tab was read once (after finishing a workout, logging an activity, undo or a new week it kept the old numbers).
    - Week report: the pending report was read once, so a new week with the app open never showed it.
    - Workouts: lift cards were cached by day (finish, undo, delete, swap and a new week kept the old cards); the activity-day card; the planned lift's preview and swap button; activity effort.
    - Tab bar: the You letter and label after a name change in Settings.
    - Workout screen: next-weight notes, carried weights and lb/kg labels after a Settings change; the swap sheet's choices.
    - History records and onboarding weights after switching lb and kg.
  - New week with the app open (Emma, Nov 16), fixed: the week only rolled at launch and on return to the app, and nothing redrew at midnight. A day clock in the root layout now wakes just after local midnight, rolls the week if due and redraws every screen; on return it does the same. `src/day-clock.test.ts` drives it with a fake clock (Sunday 23:59 to Monday, a sleep to Wednesday, and a week away).
  - Blank screen after `88fef1e` on the phone (Emma, Nov 16): no reproducer in tests; iOS bundle exports cleanly. Likely launch race: `rollWeekIfDue()` (sometimes `newWeek()`) and opening the week report sheet ran in the root layout effect before the first paint. Deferred both to the frame after paint (`requestAnimationFrame` in `_layout` and `WeekReportHost`); `onNewDay` bumps the store on a microtask. If it still blanks, need the Mac worker console capture. Web: n/a.
  - Web preview "Cannot update a component while rendering" on Start workout (Emma, Nov 16), fixed: `engine.plan()` saved the set-count snapshot the first time it saw a started day, and it runs while screens draw (the workout screen, the live pill, Plan and Workouts), so the first draw after Start updated the store mid-render. Same on iOS (dev warning only); it didn't cause wrong numbers, since every reader got the same snapshot. `plan()` no longer saves; Start, the first ticked set and the feel switch save it. Engine tests cover it.
  - Web: done Nov 16. Nothing for the compiler (the web isn't React); `src/engine.js` `plan()` no longer saves either.
- The rest bar appears without a stutter, with its text centred in the glass.
- Content scrolls under the status bar on every tab.
- Keep on the weight suggestion is remembered when you leave and reopen the workout.
- The sets picker is green.
- Workouts and Plan → Week update straight away after finishing a workout and after marking a week done.
- Supersets and lower-body focus don't repeat in the next week's changes.
- Sports can be picked in Settings → Activities. **Built on `outstanding-a-b`**, matching the web: the activities row turns activities on and off; "Sports in season" lists None plus only the sports, yoga and pilates that are on; tapping the primary sport again unpicks it. No sessions-per-week −/+ rows. Turning an activity off also clears its weekly count. Onboarding offers at most two sports (the main one plus the second from Settings), and a one-time cleanup at launch turns off any third sport with nothing logged this week. Check on the phone.
  - Web: done Nov 16 (count cleared on off, onboarding offers classes plus the second sport, one-time `capSports`).
  - Decided (Emma, Nov 16): a newly turned-on activity starts at 0 sessions a week until she sets it. Turning an activity on in Settings now sets its count to 0 on both native and web, so a count saved before it was turned off never comes back. Onboarding still pre-fills 2 for a sport it offers that isn't on yet; that's the onboarding stepper, where she sets it.
- **Phantom pickleball (3 a week she didn't choose).** No default of 3 exists (engine default is 0). The count is `wk.pickle`, the one saved place onboarding, Plan and Workouts all read through `cnt()`.
  - Cause: logging more sessions than planned raises the saved count (`apps/mobile/src/activity-log.ts` lines 314–317; web `src/main.js` line 280; documented in `docs/LOGIC.md` "Logging past the planned count raises the count"), and `newWeek` clears the logs but keeps the count (`packages/engine/engine.js` lines 899–901). One week with 3 pickleball logs leaves 3 planned every week after.
  - Fixed: onboarding now shows the saved count, including 0. Before, a saved 0 showed as 2 (`cnt(sport) || 2`), and switching main sport carried the previous sport's count over. Engine tests pin the count rules.
  - Web: done Nov 16 (`openOnb` and the sport choice show the saved count, including 0).
- **Activity days are the saved plan (Emma, Nov 16). Built on `outstanding-a-b`.** Logging extra sessions no longer raises the saved count; each is saved on the day it's logged (also past or unplanned days this week) and counts toward the week's load and fuel. Fixed: a deleted extra session no longer counts as a planned one, and sessions logged before an activity is turned off still count that week. Activity days carry over every week; unchecking one on Plan drops a planned session from the activity planned most often and stays unchecked in later weeks; checking one adds a session to the main sport. Finishing onboarding sets as many activity days as planned sessions. Workouts' activity-day card and Plan's planned activity rows say "Activity" (one activity planned) or "Activities" (more than one), with no sport names and no counts; the chips show no count. Engine tests cover carry-over, unchecking, checking, logging past the plan and the onboarding fit. Check on the phone.
  - Emma confirmed: the main sport gains a session when she checks a day; the activity planned most loses one when she unchecks. Still to confirm: this replaces the documented rule "logging past the planned count raises the count" (native only so far).
  - Web: done Nov 16. Was: stop raising the count in `logActOn` (`src/main.js` line 280); count logged sessions past the plan in the engine's load and fuel (`sessN` in `src/engine.js`); `setActivityDay` for the Activity days toggles (line 724); `fitActivityDays` at the end of `applyOnb`; "Activity" or "Activities" on Plan's planned activity rows instead of the sport name (line 444); drop "{…} of {…}" from the chips (line 423); count deleted extra sessions as nothing and keep counting sessions of an activity turned off this week (`slotMin`, `sessN` in `src/engine.js`); port the new engine tests to `tests/`.
- **Activity order and suggestion (Emma chose A and C). Built on `outstanding-a-b`.** Chips and the activity-day suggestion follow main sport, second sport, then the order activities were turned on in Settings (new saved field `wk.actOrder`; existing activities keep the fixed order). The activity-day card adds "{activity} first" (`TODO copy`). In season the season sports lead (existing `seasonSports()`); a deload week uses the same order. Engine tests cover the order, one-offs, in season and deload. Check on the phone.
  - Pills (Emma, Nov 16): Workouts keeps separate named activity pills; the combined "Activity" / "Activities" wording stays on Plan only, so the Workouts activity-day card no longer shows it (eyebrow, suggestion, log line). Web: the activity-day card (line 422) gets only the suggestion line, no combined word.
  - Decided (Emma, Nov 16): a deload week uses the same activity order as a normal week.
  - Decided (Emma, Nov 16), built: no "{activity} first" line; the suggestion is the first pill. Planned means at least one session a week: an activity on with 0 sessions has no Workouts pill or suggestion (log it from Other, which never changes a count) and is listed on Plan under "Add to your week" to add a session. Checking an activity day still adds to the main sport even at 0. Turning an activity off trims its days. After logging past the plan, a small card on today's Workouts offers to add a weekly session (Add raises the count and adds a day; Not now does nothing); asked once per activity per week. Engine tests cover planned, add, trim and the once-a-week ask.
  - Changed (Emma, Nov 16): activities on with 0 sessions keep their Workouts pill, in the same order (main sport, second sport, the rest), so they can be logged there; logging one never changes its count. Plan's "Add to your week" pills are gone (copy removed). The ask after an extra session stays, so that's how a 0-session activity becomes weekly. Other now lists only activities that are off. Web: chips are every activity that's on, Other only the ones that are off.
  - Web: done Nov 16, matching the latest decision: chips are every activity that's on (with one-offs and zone 2 in a ramp), in the native order; Other lists only activities that are off; no suggestion line and no "Add to your week"; the ask card after an extra session on today's Workouts; days trimmed when an activity is turned off; `noteAct` on the Settings toggle. `orderActs`, `noteAct`, `suggestedAct`, `plannedActs`, `setActivityDay`, `addWeekly`, the ask, `trimActivityDays`, `fitActivityDays` and `capSports` are in `src/engine.js`; their tests are in `tests/activity-plan.test.js` (30, ported from the native engine).
  - Copy approved (Emma, Nov 16): "Add {…} to your weekly sessions? It shows up every week.", "Add", "Not now". TODO markers removed (native, web, `docs/COPY.md`).
- The first lift of a new week can be swapped with any other unstarted lift that week.
- The notification icon is the new one. This needs a fresh dev build: `npx expo prebuild --clean`, then build again.
  - Checked Nov 16 (Emma: the rest alert still shows the old icon): iOS notifications always show the installed app's icon (the `expo-notifications` `icon` is Android only), so this can't change from JS or a Metro reload. The new icon is in the repo and wired: a clean prebuild puts the barbell-on-gradient icon (light, dark, tinted) in `AppIcon.appiconset`. The phone's dev build is older than the icon (`4d28f3f`). Removed the unused old `assets/expo.icon` (the Expo template icon). On the Mac: delete Lift Board from the phone (iOS caches the icon), then `cd apps/mobile && npx expo prebuild --platform ios --clean && npx expo run:ios --device`, and reload Metro. Nothing else is missing.

**A2. Next-time line format.** Section 12 says next-time lines read **Overhead Press (Barbell): 30lb x 8**, but `copy.ts` still has `nextLine: "· {…} lb · {…}"`. Find where next-time lines render (workout screen, Day done, review) and make sure every one uses the section 12 format, then remove the unused copy key.

**A3. Profile and Settings (section 19).** Compare with `docs/design/Proto_Profile.dc.html`, `Proto_ProfileNew.dc.html` and `Proto_Settings.dc.html`:
- The streak number is the same height as the flame.
- Missed weeks in the 12-flame row are faint, not missing.
- The card warms up with the streak and has the shine.
- First-week states show (fresh install or Reset profile).
- "Same weight" shows when the strongest lift hasn't gone up.

**A4. Weekly report streak.** Section 19 lists "{n} weeks in a row" on the weekly report as a later item. `week-report.tsx` has a `streak` field; confirm whether it shows. If not, leave it for Emma to decide.

**Phone test fixes on e070d5f (Nov 16), native.** Glass form sheets (swap, leg-day offer, weight suggestion, activity details) start 32pt below the top. The weight dial sheet is green (`theme.green.surface`) when its accent is green. Settings: "Sports in season: up to two…" (colon instead of the dot); rows with dividers have the same space above and below the line. Week card: the four tiles are the accent colour with dark text (Lifts green, PRs purple `theme.record` #b79cf0, Activity pink, Exercise calories orange); Sets became PRs (records this week); the Activity tile is labelled "Activity" with "{n} min". Pressed state: controls without their own fill fade slightly instead of showing a dark box; filled buttons keep the shade, clipped to their corners. History graph hours use decimals ("0.5h", "1.5h").
  - Shared week image (Emma chose option C, Nov 16): rebuilt in the workout share card's style on the flat #181513 background. Lift Board and the week range in Ranchers, the same four filled tiles, then Personal Records and Going up next week (when there are any). No completed status, no Save to Photos; Share still opens the share sheet. 1080 wide, height follows the content, captured the same way.
  - Web: done Nov 16. Delete stays on every set row (empty sets became deletable after this note); "Sports in season: up to two…"; week report tiles filled with dark text, Sets → PRs (purple), "Activity"; `hrs()` decimals in the History graph. The web report has no share image, so option C doesn't apply.

**Records purple, milestones filled, PR scroll ticks (Emma, Nov 16), native.** Everything that marks a personal record now uses the record purple (`theme.record`): History's recent PR cards (the kind label), the "PR" mark on a lift's week rows, and on You the PR cards, the empty "PR" badge and the first-PR milestone. Strength trends (lift sparklines, "up in 8 weeks", strongest lifts) keep their orange; they aren't records. Milestones on You are filled with their kind's colour, with dark text and mark (`theme.ink`); see the gradient pick below. Scrolling History's recent PRs gives a light selection tick each time a card passes, at most one every 60 ms (`src/scroll-tick.ts`, tested); haptics do nothing on the web. No new words.
  - PR cards and milestones (Emma, Nov 16): she tried the gradient (`518348c`) and didn't like it; both went solid again. Her pick for PRs from the style visual: a deep purple fill with no outline (`theme.purple.card` #3a2f55, no border), purple kind label, light value and muted date. That covers History's PR cards, You's PR cards and empty PR badge, the week report's Personal Records card (title purple) and, on the web, the Day done records card. The You layout stays. Web: the same.
  - Milestones (Emma's pick, Nov 16): "kind pairs" with lime and gold seconds, a 135° gradient per kind like the profile avatar, dark text and mark. Lifts #6fd0b4 → #c8e86a, hours #fea06a → #f5d06a, first full week and streaks #fc96bf → #fea06a, first PR #b79cf0 → #fc96bf (`theme.milestone`, `expo-linear-gradient`). Web: the same gradients in `milestones()`.

**No middle dots in copy (Emma, Nov 16), native and web.** Every " · " in user-facing words is gone from `copy.ts`, `docs/COPY.md`, both engines and `src/main.js`, replaced with a colon, parentheses or a comma: "First workout: Today", "Pickleball (in-season)", "Other activities (per week, any day)", "3 × 10 (65 lb)", "Deload suggested: …", "+1: lower body focus", "Skipped: …", "Today: Tennis (no change to the plan)", "+15s (cut)". The parsers that read the engine's reasons (`Skipped: `, `Covered: `, the why split, the "(n/m sets)" suffix) match the new form. Unused keys with dots were removed (`you.inSeason`, `history.ramp`/`deload`/`focusLine`, `workout.optionalLabel`/`goOver`/`nextLine`). Only the old-save migration (`wTitle`) still reads "Lower · …" titles saved before.
  - Web: done Nov 16. Record purple (`--record`) on History's PR kind labels, the PR mark on week rows, the empty PR badge, the Day done records card and its PR tags, the week report's Personal Records title and the first-PR milestone; milestones filled with dark text and mark. No haptics on the web.

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

## C. Emma's decisions (recorded, not built yet)

Emma decided these on Nov 16, 2026. C1, C4 and C5 are built (Nov 16); C2 is waiting on a check against her real logs; C3 is on hold.

**C1. Sheet styles. Decided:** glass sheets for every pop-up except the weekly report, the Day done card and the share card, which stay solid. **Built Nov 16 (`79ca24a`), check on the phone.** The native form sheets (swap, leg-day offer, weight suggestion, activity details) already use the system glass sheet. The custom pop-up cards are now Liquid Glass tinted with their own colour (`components/glass-sheet.tsx`): the workout confirmations (reset, finish first, delete sets), the exercise-done sheet, the exercise picker (green), the number dial (green or its context), Settings' reset/delete/restore confirm, the activity delete confirms (pink) and Plan's confirm dialog (orange). Day done keeps its solid card. Older iOS and Reduce Transparency stay solid. Tips and the first-run tab tips are popovers, not sheets, and stay solid. Web: n/a.
- Glass sheets keep their existing colour palette: swap, weights and the exercise picker are green; activities are pink; the number dial follows its context.

Earlier proposal, for reference:
- Small glass sheets for swap, the weight suggestion, activity details and confirmations.
- A large glass sheet that opens nearly full for the weekly report.
- Solid full screen for Day done.
- Solid cards inside every sheet, and a solid share card.

**C2. Upper and lower strength trend on History → Lifts. Decided:**
- The percent shows on tap.
- It also compares against the user's bodyweight when they've entered it.
- Core and carries are omitted.
- Still to do before designing the card: check the formula against her real logs.

The proposed formula:
- Each exercise's estimated 1RM, as a percentage of its own first-3-session baseline.
- Averaged per half, weighted by sets.
- Smoothed over 3 weeks, taking the best session in each week.
- Labelled Up (above +2%), Holding (within ±2%) or Down (below −2%).
- Down only shows after 2 weeks in a row below the band.
- Holding shows in green on a cut.
- Nothing shows before 3 weeks of data.

**C3. Playlist workout** (handoff section 4, board `docs/design/Proto_Playlist.dc.html`). **Decided: on hold.** Don't build.

**C4. Liquid Glass audit items 7–9. Decided:** glass for the in-page switches (Plan Week/Season and History Calendar/Weeks/Lifts). No long-press menus on day cards and no floating date line. **Built Nov 16, check on the phone:** both switches sit on a Liquid Glass track (`components/glass-track.tsx`); the selected segment keeps its orange fill. Older iOS and Reduce Transparency get a solid track (History's switch now has the same track as Plan's). Web: n/a.

**C5. The You tab's first-run tip. Decided:** new copy is "See your accomplishments and other cool profile info. Tap the gear for settings." **Built Nov 16** (native `copy.ts`, web `src/main.js`, `docs/COPY.md`).
- Decided (Emma, Nov 16): they say Settings now (native, marked TODO copy; "Training preferences" became "Training", the section's name). Backup line decided (Emma, Nov 16): "Settings → Your data → Export my data"; the web's Settings button is "Export my data" too, and the Your data intro says "Export your data now and then". Web: the same four lines in `src/main.js`. The lines were:
  - Onboarding experience: "Change it anytime under You → Training preferences."
  - FAQ "When does a new week start?": "(You → App → Week starts on)".
  - FAQ "What does experience change?": "Change it in You → Training preferences."
  - FAQ "Moving to a new phone?": "You → Your data → Download backup".

---

## Keep the docs current

When something ships or a decision changes, update in the same commit:
- this file;
- `docs/SCREENS.md` and `docs/COPY.md`, for screens and words;
- `docs/LOGIC.md` and both engines' tests, for rules;
- `docs/CONTEXT.md`, when a product decision changes or something is decided against.
