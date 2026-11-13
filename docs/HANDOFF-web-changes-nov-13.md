# Web app changes to bring into the native app (Nov 8 – 13, 2026)

These were built in the web app (`src/`) after the native project started. Bring each one into `apps/mobile`, following `.cursor/rules/`. The web app is the reference: for exact behaviour, read the commit listed with each change (`git show <hash>`).

Do them in this order, one chat each. Commit after each one.

---

## 0. Sync the engine first

The engine in `src/engine.js` gained new functions (workout swaps, week actuals) and two renamed workouts. `packages/engine` is meant to stay identical to it.

- Compare `src/engine.js` with `packages/engine/engine.js` and copy the differences across. Do the same for `tests/engine.test.js` → `packages/engine/tests`.
- All 70 tests must pass after syncing (67 before, plus 3 new).
- If `packages/engine` was changed during the native build, list those changes before overwriting anything.

New engine exports: `swapOptions`, `swapDay`, `weekActuals`, `sessionKcal`.

---

## 1. Workout renames (`92516f8`)

Titles only; nothing else changes. They come from the engine, so syncing the engine covers it.

- `Upper` → **Upper · Press**
- `Lower · Quad` → **Lower · Quad & Glute**

Past sessions in History keep the title they were logged with.

---

## 2. Swap a workout (`792d1ed`, `277417b`, `cd04308`, then copy and spacing commits through `22bd07f`)

Lets you replace a planned lift with another one.

**Engine (already in the sync):**
- Families: lower = Hinge & Glute, Quad & Glute, Glute & Hamstring, Lower; upper = Upper · Press, Upper · Pull, Upper · Delts & Arms; full body = A, B, C.
- `swapOptions(id)` returns the same-family workouts that are not already in this week, plus the current one.
- `swapDay(curId, newId)` stores the choice in `wk.alt` (planned id → chosen id). It sticks until changed and updates `upNext` and `pinToday`.

**Where the button shows:**
- A small **Swap** pill (two-arrow icon + "Swap") at the top right of the Workouts lift card, on today's lift and planned lifts.
- A **Swap workout** pill under the title on the workout screen.
- Hidden once the workout is started (timer running) or done.
- The old "Switch to …" link under Start workout is removed; its job moved into the sheet.

**The sheet:**
- A dimmed overlay (black at 75%) behind it; tapping the overlay closes it.
- Title **Swap workout** (DM Sans 600, 20px, sentence case), a close button, a little top padding.
- Body: **The week will adjust to any swaps.**
- Section **Same muscle group**: one row per family option (title + its first three exercises, joined with " · "). Picking one calls `swapDay` and, if the workout screen is open, switches to the new id.
- Section **Planned** (only on today's lift): the other lifts still to do this week. Picking one moves it to today (`wk.pinToday = {d: today, id}`), with a toast "<title> moved to today".
- Rows are dark fills (black at 30%), 12 radius, tight spacing (6px between rows, 8px above each section label).

---

## 3. Mark week as finished (`1478db8`)

Lets you close the week early and plan the next one.

- A full-width secondary button **Mark week as finished** at the bottom of Plan → Week (hidden once finished).
- Confirm dialog: title "Finish this week?", text "This week's numbers are saved to history and next week's plan starts now. Lifts you didn't get to come first next week. You can undo until next week begins.", button "Finish week".
- On confirm: save a snapshot of `wk` and `slots` (for undo), call the engine's `newWeek(nextWeekStart)`, show the Week done summary.
- While finished early (`wk.weekStart` is later than this calendar week's start):
  - Plan shows next week: the title is next week's date range and the list is titled "Next week's plan".
  - A note at the top of Plan → Week: "**Week finished.** This is next week's plan; it starts <Mon, Nov 16>. Anything you log before then counts toward it." with an **Undo** button.
  - The rest of this calendar week shows as open days on Workouts; "View next lift" points at next week.
  - The automatic Monday rollover does not run again.
- **Undo** restores the snapshot but keeps any sessions logged since finishing; toast "Week reopened". Undo is only offered until the new week starts.
- See `earlyDone()`, `planOff()`, `finishWeek()`, `undoFinish()` and the changes to `weekModel` / `weekModel0` in `src/main.js`.

---

## 4. Rest bar (`6adeb73`)

- Layout, edge to edge: **−15s** tap zone (left) | **Rest 2:57** with a small underlined **Skip** under it (middle) | **+15s** tap zone (far right). +15s must always be visible on a narrow phone.
- The time shows no reason text (no "· cut"); just "Rest m:ss", or "Go · m:ss over" after zero.
- **Sound must not pause the person's music.** In the web app this is `navigator.audioSession.type = "ambient"`. In native, set the audio mode with expo-audio so the chime **mixes with other audio** (or briefly ducks it) and never interrupts it. The locked-phone local notification is unchanged.

---

## 5. Share a finished workout (`6eb7867`, `10664bc`)

A Strava-style image of the workout.

- **Day done** summary: a secondary **Share** button (share icon) next to the main button, which now says **Finish & close**.
- Completed workout screen: a full-width **Share workout** button under "✓ Day done".
- The image (1080 wide, at least 1350 tall, taller with more exercises):
  - Dark green-to-black gradient.
  - "LIFT BOARD" in Ranchers (green) top left, the date top right.
  - The workout title in Ranchers, uppercase, up to two lines.
  - Three tiles: **min**, **sets**, **going up** (going up in orange when above 0).
  - "TOP SETS": one row per exercise, name left and top set right in DM Mono (e.g. "185 × 8"), orange with ↑ when it goes up next time; cardio rows show minutes; "+ N more" after 9 rows.
- Data: the latest lift session for that day this week (`ex`, `min`), the review tags (`wk.review[id]`), sets logged.
- Native: render the card as a React Native view, capture it with `react-native-view-shot`, then open the share sheet (`expo-sharing`), which gives Save Image / Copy / Messages / Instagram. The web version's canvas drawing in `shareCardBlob()` is the visual reference.

---

## 6. History weeks use what was logged (`08a8fba`, `b66ec57`)

Before, a week's History card showed the plan saved when the week closed (planned sport minutes, planned cardio). Now:

- Each past week card computes its numbers from `wk.sessions` in that calendar week with the engine's `weekActuals(start)`:
  - **min sport** = logged minutes of sport activities.
  - **kcal extra burn** = net calories (above resting) from logged activities (by MET and minutes) plus lift-day cardio finisher minutes saved in each lift session's `ex`.
- Edits made after a week closed now show up.
- Weeks with no sessions (older data) fall back to the saved numbers.
- The label is **kcal extra burn** (was "kcal cardio"). No explanatory note under "Previous weeks".
- The **Week done** summary tile is **Extra burn** and uses the same calculation.

---

## Copy changes in one place

Add or update these in `copy.ts` (and `docs/COPY.md`):

| Where | Copy |
| --- | --- |
| Workout titles | Upper · Press; Lower · Quad & Glute |
| Lift card button | Swap |
| Workout screen button | Swap workout |
| Swap sheet title | Swap workout |
| Swap sheet body | The week will adjust to any swaps. |
| Swap sheet sections | Same muscle group; Planned |
| Swap toast | {title} moved to today |
| Plan button | Mark week as finished |
| Finish confirm | Finish this week? / This week's numbers are saved to history and next week's plan starts now. Lifts you didn't get to come first next week. You can undo until next week begins. / Finish week |
| Finished note | Week finished. This is next week's plan; it starts {date}. Anything you log before then counts toward it. |
| Finished buttons and toast | Undo; Week reopened |
| Plan list title when finished | Next week's plan |
| Rest bar | Rest {m:ss}; Skip; Go · {m:ss} over |
| Day done buttons | Share; Finish & close |
| Completed workout | Share workout |
| Share image | LIFT BOARD; min; sets; going up; TOP SETS; + {n} more |
| History week card | min sport; kcal extra burn |
| Week done tile | Extra burn |
