# Today's web changes and three new features

Build in the native app (`apps/mobile`), following `.cursor/rules/`. One section per chat, in order. Commit after each.

The three new features have reference designs in `docs/design/` (`Proto_WeekReport.dc.html`, `Proto_History.dc.html`, `Proto_Playlist.dc.html`). They're HTML mockups: read the markup for layout, colours and copy, and the `renderVals()` script at the bottom for the behaviour. The numbers in them are sample data; real numbers come from the engine.

---

## 1. Onboarding and pace (from the web app, commit `187fe0f`)

**Copy** (update `copy.ts` and `docs/COPY.md`):
- Step 1 title: **What do you do?**
- Step 1 text: **Your main activity sets the season. In-season, lifting is deprioritized so you're fresh.**
- The live card: **Plan so far** (was "Your plan so far").

**Plan your week cards:** each card has a cause pill → result pill example that swaps between two examples. Within each card, the cause pill fades first and the result pill follows **0.45s later**. The three cards stay staggered against each other as before.

**Level demo slider:** it glides to each stop (about 450ms, ease out) instead of jumping, both when it steps on its own and when a level name is tapped. Dragging is continuous and settles on the nearest stop on release. Reduce Motion: no glide.

**Pace (Plan → Season, fat-loss goals only):** replace the pace pills with the existing `NumberDial`:
- Values in lb a week (kg if units are kg), 0.1 lb steps (0.05 kg), from 0.2 up to the goal's cap: 1% of body weight for Lose weight fast, 0.7% for Lose fat, keep strength. At 138 lb that's 0.2 to 1.3.
- Under it: "{pct}% of your weight a week".
- Still store `wk.ratePct` (% of body weight, up to 4 decimals) so the lb figure follows weight as it changes. `fitPace` clamps to the cap instead of snapping to the old three options.

---

## 2. Weekly report

A sheet that opens when the week is finished (Mark week as finished, or the automatic Monday rollover the first time the app opens in the new week). It replaces the current "Week done" summary. Reference: `Proto_WeekReport.dc.html`.

Top to bottom:
- The week's date range in Ranchers, with a **Completed** pill on the same line, aligned right, when every planned lift was done (or "{done} of {planned} lifts" when not). No eyebrow and no line of body text.
- Four tiles: **Lifts** {done}/{planned}, **Sets** (sets logged), **Activity minutes** (min of sport, from `weekActuals`), **Exercise calories** (kcal from lifts, activities and cardio, above resting burn; from `weekActuals().burn`). Numbers count up from 0 over 600ms.
- **Going up next week**: each exercise whose next-time target goes up, "{last top set} → {next target}" with the target in orange.
- **Personal Records** (only if there are any): see the PR rule in section 3. Each row shows the exercise, the kind of record ("Heaviest top set", "More reps"), the new value and what it was before.
- **Sets by muscle**: done vs planned per muscle group for the week, as bars; groups under plan in yellow. No sentence under the bars and no "done / target" label.
- **Activities**: each logged activity with count and minutes.
- Buttons: **Share** (secondary; same share flow as the workout share card) and **See next week** (closes the sheet and opens Plan → Week).

**Data to save:** when a week closes, save its per-muscle sets (done and planned), PRs and lifts done/planned in the week's history record, so the report and History can show them later. Weeks closed before this ships won't have the per-muscle numbers; show what exists and leave that section out.

Haptics and motion are in `docs/HANDOFF-alerts-haptics.md` Part 3 ("Week finished").

---

## 3. History: Weeks and Lifts

Keep the Calendar view as it is. Reference: `Proto_History.dc.html`.

**Weeks**
- At the top, a strip of small squares for recent weeks (orange #fea06a = completed, dark = not) and "{n} weeks completed in a row" in the same orange.
- Each week card: date range in Ranchers, a status pill (**✓ Completed**, or "{done} of {planned} lifts"), and three numbers: Lifts, Sets, Exercise kcal.
- Tapping a card expands it to show **Sets by muscle** (same bars as the report).
- An incomplete week shows what was missed ("Missed Upper · Pull") and a **Count as completed** button, for sick or travel weeks; it then reads **✓ Counted** and counts toward the streak. **Undo** reverses it.
- A week is completed when every planned lift was done.

**Lifts**
- **Recent PRs**: a horizontal row of cards (kind, exercise, value, date).
- **Main lifts** with an (i) button next to the title. Tapping it opens a tip: "**1RM** is an estimate of the most you could lift once, worked out from your top set (weight × (1 + reps ÷ 30)). It's for tracking trends; you never need to test it." Then the dumbbell icon with "Your top set: the heaviest set you did that week." and "Shown for the last 8 weeks." No other explanatory text on the screen, and no "est." anywhere.
- One row per main lift: the 1RM in DM Mono with "lb 1RM", then the dumbbell icon (`tab-workouts`, 14, accessibility label "Top set") followed by the top set and "{+n} in 8 wk", and a sparkline of the 1RM over the last 8 weeks. Tapping a row expands a table: Week of, Top set, 1RM, with "PR" in orange on weeks that set a PR.

**Engine (add to `packages/engine` with tests):**
- `e1rm(w, r)` = round(w × (1 + r / 30)). Bodyweight exercises have no 1RM.
- Top set per exercise per week from `exHist`.
- **PR rule:** a PR is a **heavier top set** than any before, or **more reps at the same or heavier weight**. A higher 1RM alone doesn't count; with steady progress it would flag almost every week. Bodyweight exercises can be a PR the same way (more reps, or more added load). They still have no 1RM.
- `weekStreak()`: consecutive completed (or counted) weeks ending with the last closed week.

---

## 4. Playlist workout (experiment)

A second way to run the workout screen: one exercise and one set at a time. Build it as an option, not a replacement: **You → Training preferences → Workout view: List / One at a time**, default List. Same data and engine rules as the list view; nothing new in the engine. Reference: `Proto_Playlist.dc.html` (its rest times are sped up 4×; use real ones).

- **Top:** back link, workout title, elapsed time; a progress bar per exercise filling as its sets are logged.
- **Set view:** "Exercise {n} of {total}", exercise name, "Target {w × r} · Last time {w × r}", "Set {n} of {total}" with a dot per set. Two large steppers: **Weight** (−5 / +5, or the exercise's increment) and **Reps** (−1 / +1), prefilled with the target. Big primary button **Log set {n}** (**Log last set** on the final one). Sets already logged for this exercise listed under it. At the bottom: "Then {next exercise}" and **Skip to it ›**.
- **Rest view** (after Log set): a ring counting down with the time in DM Mono, "Rest" above it; **−15s**, **Skip**, **+15s**; an "Up next" card (the next set and its weight × reps, or the next exercise and its target). At zero the ring and time turn orange and read **Go**, and the middle button becomes **Next set**. Uses the same rest timer, notification, Live Activity and haptics as the list view.
- The next set is prefilled with what was just logged.
- After the last set, the usual Day done summary.
- Count how often each view is used (an `events` row when a workout starts with its view), so you can decide later whether to keep it.

---

## 5. Small changes from the web app (Nov 13 evening)

**Engine first:** these live in `src/engine.js`; port them into `packages/engine` (which has moved on from the web copy, so add them rather than copying the file) with the three new tests from `tests/engine.test.js` ("lift calories") and the updated "week actuals" test.

- **Lift calories are worked out, not entered.** Remove "Avg lift kcal" from You → Training preferences. The engine's `liftKcal()` is weight training at MET 5, net of resting burn, for the average lifting minutes of your last 12 timed lifts (finisher minutes excluded), or your session length until there are 3. `refreshLiftK()` stores it in `wk.liftKAuto`; it runs once at the weekly rollover (`newWeek`), and the first time the plan is built if it's missing. The fuel math uses `wk.liftKAuto` instead of `wk.liftK`. The Fuel "How this is calculated" line for lifting adds "({n} kcal a session, worked out weekly from how long your lifts take)".
- **Exercise calories include lifting.** `sessionKcal` for a lift session now counts the lifting minutes at MET 5 plus the cardio finisher, so `weekActuals().burn` covers everything you did.
- **Rename "Extra burn".** Week done / weekly report tile: **Exercise calories**. History week cards: **exercise kcal**. Update `copy.ts` and `docs/COPY.md`.
- **Swiping on Workouts.** Anywhere below the week strip, swipe left/right to change day (already built; make sure it works over the whole area, not just the cards). On the M–Sun strip itself, swipe left/right to change week, with the strip sliding in that direction. Ignore vertical drags and swipes that start in a text field.

---

## 6. Workouts: scroll through days like pages

Swiping today only jumps to the next day once you let go. Instead, the day should follow your finger, so you can drag partway and see the next or previous day before deciding, like flipping pages in Photos.

**Days**
- Everything below the week strip (the day line, the day's cards, the activity chips, Fuel & recovery) is one page per day, in a horizontal pager. Use a horizontal `FlatList` with `pagingEnabled` (or `react-native-pager-view`), with `getItemLayout`, the selected day as `initialScrollIndex`, and a small render window (the current page and one either side).
- Range: the same days you can reach now (8 weeks back to the end of next week).
- While dragging, the neighbouring day slides in alongside. On release it snaps to the nearest page; a quick flick moves one page. At either end of the range it rubber-bands.
- Each page scrolls vertically on its own. A drag only becomes horizontal when it's clearly sideways, so vertical scrolling never turns into a page change.
- When a page settles: the selected day updates, the week strip highlight moves to it (and the strip moves to that week if you crossed into another one), and a selection haptic fires.
- Tapping a day in the strip, the ‹ › arrows, "Today" and "View next lift" move the pager there: animated for nearby days, instant when it's more than 3 days away.

**Week strip**
- The M–Sun strip is also a horizontal pager, one week per page, that follows your finger the same way. Settling on a week keeps the same weekday selected (or today, when it's this week) and moves the day pager to match.

**Reduce Motion:** dragging still works (you're moving it directly), but taps jump without animation.

**Done when:** I can put my thumb on today's card, drag slowly left, see tomorrow sliding in, let go halfway and have it settle on tomorrow, and the strip shows tomorrow selected.

---

## 7. Polish pass (Nov 13 night)

Most of these were spotted in the native app; the web app has the same changes where it has the same screen (see the web commit for this section).

**Copy**
- Remove the small grey line under **Week starts on** ("A new week begins on its own") and under **Next-morning check** ("Did you play or train yesterday?") in You → App. Also remove "A new week begins on its own." as the empty note under History → Weeks (show nothing there).
- Plan → Week: **Lift days** and **Activity days**, without "Usual" and without the "· 3 a week" count. Same on the onboarding lift-days step.
- History chart legend: **Activity** instead of "Sport".

**Plan → Week: Fuel/Recover**
- Panel title **Fuel/Recover** (was "Fuel & recovery") with an (i) button right after it.
- Remove the "How this is calculated" expandable link. Its content moves into the (i) tip, titled "How this is calculated": the maintenance breakdown, then "Weekly deficit: {n} kcal." and "Remaining finishers: {m} min × {n}." when they apply.

**You**
- The You tab uses the **pink** theme (like activities): tab bar icon and label, section titles, selected pills and switches, the experience slider. Workouts stays green; Plan and History stay orange.
- FAQ rows: too much space under each question. Make the space above and below the question equal and tighter (about 9px top, 7px bottom, plus the divider), so the list reads as one even list.

**History → Lifts**
- Everything on the Lifts view is **orange** (#fea06a) instead of green: sparklines and their end dot, the "+n in 8 wk" change, PR marks.
- **Main lifts list:** remove the big 1RM number from each row. A row shows the exercise name, the dumbbell icon with the top set and the change, and the sparkline. The 1RM appears only in the expanded table when a row is tapped.
- The (i) next to "Main lifts" sits right after the title (4–6px gap), not pushed to the far edge.

**History → Calendar**
- The weekly chart's average line goes **behind** the bars, not over them. Make it a neutral colour (the muted grey, about 40% opacity, dashed is fine) and label its value with a unit: "{n}h" when it's an hour or more, "{n}m" when under an hour (e.g. "1.5h", "45m").
- When a past day is selected under the calendar, don't repeat the workout title as a line under the heading (the "Lower · Glute & Hamstring" row). The heading already names it; show the exercises directly. Activities keep their "Pickleball · 90 min" line.

**Workout: weight suggestion as a popup**
- When a ticked set is clearly too easy (2+ reps over the top of the range) or too hard (under the range), don't show the suggestion inline in the exercise card. Show a small bottom sheet over the dimmed screen about a quarter of a second after the tick (the rest timer keeps running underneath):
  - Title: **That looked easy** or **Tough set** (DM Sans 600, 20px).
  - Text: "{reps} reps on {exercise}. Go up to **{weight} lb** for the rest of the sets?" or "… Drop to **{weight} lb** for the rest of the sets to stay in range?"
  - Buttons: **Keep {current}** (secondary) and **Use {new}** (primary). Use fills the new weight into every set not yet ticked. Keep, the close button or tapping the overlay just closes it.
  - It's asked once per set: closing it never brings it back for that set.
  - Haptic: light impact when it appears (same as the toast).
