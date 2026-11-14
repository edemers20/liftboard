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
- An incomplete week shows what was missed ("Missed Upper (Pull)") and a **Count as completed** button, for sick or travel weeks; it then reads **✓ Counted** and counts toward the streak. **Undo** reverses it.
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
- The day line ("‹ Friday, Nov 13 ›") stays fixed in place; only its date text changes. Everything below it (the day's cards, the activity chips, Fuel/Recover) is one page per day, in a horizontal pager. Use a horizontal `FlatList` with `pagingEnabled` (or `react-native-pager-view`), with `getItemLayout`, the selected day as `initialScrollIndex`, and a small render window (the current page and one either side).
- Range: the same days you can reach now (8 weeks back to the end of next week).
- While dragging, the neighbouring day slides in alongside. On release it snaps to the nearest page; a quick flick moves one page. At either end of the range it rubber-bands.
- Each page scrolls vertically on its own. A drag only becomes horizontal when it's clearly sideways, so vertical scrolling never turns into a page change.
- When a page settles: the selected day updates, the week strip highlight moves to it (and the strip moves to that week if you crossed into another one), and a selection haptic fires.
- Tapping a day in the strip, the ‹ › arrows, "Today" and "View next lift" move the pager there: animated for nearby days, instant when it's more than 3 days away.

**Week strip**
- Remove the ‹ › buttons on either side of the M–Sun strip. The strip itself scrolls sideways a week at a time and follows your finger the same way. Settling on a week keeps the same weekday selected (or today, when it's this week) and moves the day pager to match.
- The ‹ › buttons beside the date stay; tapping them changes the date in place and slides the content below like the carousel, exactly as a swipe would.

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
- When a past day is selected under the calendar, don't repeat the workout title as a line under the heading (the "Lower (Glute & Hamstring)" row). The heading already names it; show the exercises directly. Activities keep their "Pickleball · 90 min" line.

**Workout: weight suggestion as a popup**
- When a ticked set is clearly too easy (2+ reps over the top of the range) or too hard (under the range), don't show the suggestion inline in the exercise card. Show a small bottom sheet over the dimmed screen about a quarter of a second after the tick (the rest timer keeps running underneath):
  - Title: **That looked easy** or **Tough set** (DM Sans 600, 20px).
  - Text: "{reps} reps on {exercise}. Go up to **{weight} lb** for the rest of the sets?" or "… Drop to **{weight} lb** for the rest of the sets to stay in range?"
  - Buttons: **Keep {current}** (secondary) and **Use {new}** (primary). Use fills the new weight into every set not yet ticked. Keep, the close button or tapping the overlay just closes it.
  - It's asked once per set: closing it never brings it back for that set.
  - Haptic: light impact when it appears (same as the toast).

---

## 8. Polish pass 2 (native app)

Native only. Do it in two or three chats (Workout screen; Workouts tab; History, nav, You and first-run tips), committing after each.

### Workout screen
- **Optional section:** more space under the "Optional" heading (about 12px before the first exercise).
- Exercises inside the Optional section don't repeat "optional" in their own label.
- An exercise that's being skipped (not started, or skipped) shows no ✓ tick buttons on its set rows.
- **Add exercise** is a plain text button ("+ Add exercise", accent colour, no fill or outline), still at least 44pt tall to tap.
- Collapsed exercise cards have no › chevron.
- The next-time line under an exercise is text only: "Go up to 45 lb", "Ease to 35 lb", "Stay at 40 lb". No "=", arrow or other icon in front.
- **Stretch:** label is just "Stretch" (no "optional"), no "8 min" pill, and it sits above "+ Add exercise".
- **Opening and closing a workout:** make the transition crisp. The card expands into the page in about 240ms (no overshoot, ease-out), and its content fades in only once the page has reached full size. Closing reverses it into the card in about 200ms. No blur or long cross-fade. Reduce Motion: a quick fade.

### Tips everywhere (workout, Plan, You, History)
- Tapping an (i) never opens a bottom sheet with a dimmed overlay. It opens a small popover on the page, anchored to the (i) with a pointer, about 280pt wide, dark card (#2f2a27), 13pt text. Tapping outside, the (i) again or scrolling closes it. Only one open at a time. Short tips (one line) can show inline under the row instead.
- The weight suggestion after a set ("That looked easy" / "Tough set") stays a popup, since it asks you to decide something.

### Workouts tab
- **Logging an activity** (tapping its chip or picking it from "Other"): the logged activity card expands inline right there, showing minutes and **How hard was it?** with **Easy / Moderate / Hard** pills (default Moderate). Spin, yoga and Pilates keep their existing effort options instead. Store the choice on the session.
  - Proposed effect (tell me if you want it different): Easy ×0.85 and Hard ×1.15 on the activity's calorie rate; Hard also adds 1 to recovery load, like a really hard spin class.
- **Deleting a logged activity** that isn't one of your regular activities (it was logged once through "Other") removes it everywhere: the session, and the activity itself, so it doesn't show up on Plan, in "This week's plan" or as a chip. Track this with an "added just for this log" flag when "Other" turns an activity on. Regular activities just lose that session.
- **Day pager:** see section 6 (updated): no ‹ › buttons beside the week strip; the date line stays put and the content below slides like a carousel.

### History
- Weeks: the streak strip uses a **flame** icon per week (Lucide `Flame`, outline, 14pt) instead of squares: orange (#fea06a) for completed weeks, the muted grey for weeks that weren't.

### Tab bar
- Use the native iOS tab bar so it gets **Liquid Glass** on iOS 26: Expo Router's native tabs (`expo-router/unstable-native-tabs`, check the docs for the installed SDK). Keep our four icons (pass them as template images) and labels; tint the selected tab with the tab's theme colour (green, orange, orange, pink). On older iOS it falls back to the standard translucent tab bar. If native tabs can't take our icons, use `expo-glass-effect`'s `GlassView` behind the existing custom tab bar instead and tell me.

### You
- **Dividers** between the Activities, Season and Lifting groups in the profile editor are uneven. Use exactly one 1px line between groups, with the same space above and below it (16px), and no line above the first group or below the last.
- **Play test sound** needs a pressed state (dims and scales to 97% while pressed) and reads "Playing…" while the chime plays.

### First-run tab tips
After onboarding, the first time each tab is opened, show a small popover above that tab's icon in the tab bar (pointing at it) with a title and one or two lines. Tapping anywhere dismisses it; each shows once (store a flag per tab); "Replay tour" on You resets them.

| Tab | Title | Text |
| --- | --- | --- |
| Workouts | Workout Tab | where your workouts for every day of the week are shown. You can move them around, swap them for different lifts and log activities. |
| Plan | Plan Tab | Week shows your week overview - update your check-in to see your plan adjust. Season shows your overall plan and goals. |
| History | History | view your past activities, weeks completed and personal bests. |
| You | You | change your preferences for tips, experience level, and FAQs about app calculations. |

Use this copy exactly as written; don't edit it.

---

## 9. Headers hide on scroll, come back on scroll up (native)

Today each tab's top area (title and switcher, or the Workouts title and week strip) stays fixed while the content scrolls under it. Change it so the header gets out of the way while reading and comes straight back when you scroll up, like Safari's toolbar.

**Which headers**
- **Workouts:** the LIFT BOARD title row and the M–Sun week strip hide together. The date line ("‹ Friday, Nov 13 ›") stays pinned at the top while they're hidden, so you always know which day you're on.
- **Plan:** the date-range title and the Week / Season switch.
- **History:** the HISTORY title and the Calendar / Weeks / Lifts switch.
- **You:** the YOU title.
- **Workout screen:** the whole top area scrolls away, including the back link and the Swap workout button, and comes back on scroll up like the tab headers. Swiping from the left edge still goes back while it's hidden.

**Behaviour**
- Scrolling down more than about 8pt hides the header by sliding it up out of view; it moves with the scroll rather than on a timer.
- Any scroll up of more than about 8pt slides it back in, wherever you are on the page.
- It's always shown at the very top of the page, after switching tabs or views, and when tapping the status bar (which also scrolls to the top).
- When scrolling stops halfway, it settles fully shown or fully hidden (whichever is closer) with a short spring, about 200ms, no bounce.
- Horizontal swipes (the day carousel, the week strip) never show or hide it.
- The page content keeps its place: reserve the header's height as top padding so nothing jumps as it hides.
- A solid strip the colour of the page background always covers the status bar area, so content never shows under the clock.
- The tab bar does its own thing (`minimizeBehavior` in the audit, item 5); they don't need to move together.

**How:** one shared hook (for example `useHideOnScroll()`) using Reanimated's scroll handler and a clamped scroll delta, applied to every tab's ScrollView or FlatList. Don't build it separately per screen.

**Reduce Motion:** the header fades out and in instead of sliding.

---

## 10. History → Lifts rows (native)

- Exercise name: 16pt, DM Sans 600 (was 14pt regular).
- Remove the " · " separator before the change ("+25 in 8 wk"). Put an 8pt gap between the top set and the change instead; keep the change orange when it's going up (section 7).

---

## 11. App icon and animated splash (native)

**App icon (already done in the repo; just check it builds)**
- New icon: a dark barbell on the green-to-peach gradient. Files in `apps/mobile/assets/images/`: `icon.png` (light), `icon-dark.png` (gradient barbell on dark, for iOS dark mode), `icon-tinted.png` (grayscale, for iOS tinted mode), and the Android adaptive set (`android-icon-foreground/background/monochrome.png`). Sources are SVGs in `apps/mobile/assets/brand/`.
- `app.json` now points `ios.icon` at the light / dark / tinted PNGs instead of the old `assets/expo.icon`. Check that this form is supported by the installed SDK; if not, use `icon.png` alone and tell me. Delete `assets/expo.icon` once the new icon shows up.
- Icons only change in a new build (development build or TestFlight), not in a reload.

**Animated splash**
Reference: `docs/design/splash-preview.html` (open it in a browser and tap Replay). Total about 2.6 seconds.
1. The native launch screen (static, set in `app.json`): page colour #181513 with the empty bar and its two white collars (`splash-icon.png`, 304pt wide, centred).
2. As soon as the app has loaded, an in-app splash view takes over, drawn with react-native-svg at exactly the same size and position, so nothing jumps. Hide the native splash only once it's on screen (`SplashScreen.preventAutoHideAsync()` / `hideAsync()`).
3. Plates slide on from off-screen, mirrored on both sides, biggest first: green, then pink, then orange, each about 420ms with a slight overshoot as it lands, starting 160ms apart. A light haptic as each pair lands.
4. The whole barbell dips about 3pt and comes back (500ms), as if it took the weight.
5. "LIFT BOARD" in Ranchers fades in below it.
6. At about 2.3s it fades out (350ms) into the app.

Rules:
- Only on a cold start, not when coming back to the app from the background.
- Tapping anywhere skips to the app.
- Don't wait for the animation to load data: load in parallel, and if loading takes longer, hold on the loaded barbell until it's ready.
- Reduce Motion: no sliding or dip; the plates and name fade in together, then it fades into the app (about 1s total).

---

## Web app parity (Nov 13 night)

The web app now has working versions of most of these, useful as a behaviour reference (`src/main.js`, `src/engine.js`):
- Section 2: weekly report sheet (`weekDone()`), with the week record saving sets, sets by muscle, PRs, what goes up and missed lifts (`newWeek()` in the engine).
- Section 3: History Weeks (flame streak, Completed / Counted, Count as completed) and Lifts (Recent PRs, rows with the dumbbell top set, expandable 1RM table, (i) tip). Engine: `e1rm`, `prsBetween`, `weekComplete`, `weekStreak`, `countWeek`, with tests.
- Section 6: the day pager (`bindPager()`, `pagerTo()`), the week strip without arrows that swipes a week at a time.
- Section 8: workout polish, activity effort (`EFF_MULT`, Hard adds 1 to recovery load) and one-off activity delete (`wk.adhoc`), Play test sound states, even profile dividers, first-visit tab tips (`TAB_TIPS`).
- Section 9: headers hide on scroll (`.thead`, `hideOnScroll()`).
- Section 11: the new icon and the plate-loading splash (`#splash` in `index.html`).

---

## 12. Titles, next-time lines and the share card (native)

The web app has all three (commit after `02da198`); port the engine parts into `packages/engine` with the tests.

**Workout titles: parentheses instead of a middle dot**
- Lower (Hinge & Glute), Upper (Press), Lower (Quad & Glute), Upper (Pull), Lower (Glute & Hamstring), Upper (Delts & Arms). Full Body A/B/C and Lower stay as they are.
- Change them in the engine's day list, so every screen, the share image, notifications and the Live Activity pick them up.
- Saved sessions keep their title, so convert old ones once on load: "Lower · X" / "Upper · X" → "Lower (X)" / "Upper (X)" (`wTitle()` in `src/engine.js`), and the missed-lift names stored on past weeks.
- Where only the second part is shown (the calendar day heading), take the text inside the parentheses.

**Next-time lines**
- Format: **Overhead Press (Barbell): 30lb x 8**. The exercise name, a colon, the weight with its unit and no space, " x ", the rep target. Bodyweight: "Pull-up: BW x 9" or "Pull-up: BW+5lb x 8".
- No "=" or other icon in front, no " · " separators, no word "reps" and no word "hold".
- Keep a short grey note after it only when it changes what you do ("too light, bigger jump", "reps fell off across sets; rest longer, same weight", "3 misses · ease 5%").
- The engine's `review()` now returns `r` (the rep target) alongside `w`.
- In the Day done list, the ↑ / ↓ marks stay for going up or easing off; holding shows nothing.
- The "Day done" toast says "Next time: 2 moving up" (no "holding" count).

**Share card**
- The third tile is **PRs**: the number of personal records set in that workout (`prsBetween()` for that day), orange when above 0. It replaces "going up".
- **Save to Photos** is the main option: on Day done, a full-width "Save to Photos" button (download icon) with a square Share icon button beside it, then "Finish & close" under them. The completed workout screen shows the same pair.
- Native: Save to Photos writes the image straight to the photo library with `expo-media-library` (ask for add-only permission the first time) and shows a toast "Saved to Photos". The Share icon opens the share sheet as before.

---

## 13. Date line without "Today" (native)

- The Workouts date line shows only the date: "‹ Friday, Nov 13 ›", never "Today · Friday, Nov 13". The ringed day in the week strip and the disabled Today button already say it's today.

---

## 14. Logging an activity without the page jumping (native)

- **Order on a Workouts day:** the day's cards, then the activity chips, then **Fuel/Recover last**. (The native app currently puts Fuel above the chips; the web app has the right order.) Fuel sums up the day, so it reacts to what's above it; the chips are an action and belong next to the cards they create.
- **Logging an activity:** the new activity card appears in place, above the chips, and opens inline with an animation: height grows over about 320ms (ease-out), then the "How hard was it?" pills and the minutes row fade and rise in. Keep the scroll position; if the card would be off screen, scroll just enough to show it. Reduce Motion: no animation.
- **The leg-day swap offer** ("You logged Pickleball today. Swap Lower (Hinge & Glute) for Upper (Press) so your legs can recover?") is no longer a banner that pushes the page down. About half a second after logging, it opens as a bottom sheet over a dimmed overlay: title "Swap today's workout?", that text, and **Keep plan** / **Swap**. Swap moves the upper day to today (toast "{title} moved to today"); Keep plan, the close button or the overlay closes it. It's asked once per day, and not at all if today's lift is already done.

---

## 15. This week's changes and Watch as headlines (native)

The web app has this; the logic is in the engine (`changeItems()`, `watchItems()` in `src/engine.js`, with tests), so port those into `packages/engine` and build the screens on them. Use the headline copy exactly as written in the engine.

**This week's changes**
- One row per cause. Bold headline is the cause ("Lower body focus", "225 min pickleball", "Recovery load 4 (soreness, drinking, hard spin)"); under it, a grey one-line summary ("2 sets added and 2 sets cut", "1 set cut and 1 other change", or the single change itself when there's only one).
- Tapping a row opens its detail as small pills: added sets in green ("Lower accessories +1 set"), cut sets muted, other changes plain. Tap again to close. Rows with a single change don't open.
- No arrows, bullets or middle dots.

**Watch**
- Each note is a bold headline with its sentence under it in grey. Headlines come from `watchItems()`: Need more fuel, Watch your cycle, Need more recovery, Reps dropping, Fuel raised, Aggressive pace, Time for a break, Long finishers, Pace capped, Cardio capped, Keep intense activity easy, Strength first, Protein.
- Notes that share a headline merge into one row (their sentences run together): Need more fuel covers eating too little, a steep food deficit and activity covering the whole deficit; Need more recovery covers 6 and 7 lift days; Strength first covers both cut notes; when both apply, show only "At this pace, expect to hold muscle and strength rather than build."
- Not shown in Watch: close to daily, a busy week, two sessions a day.
- Keep intense activity easy (text: "Keep intense activity easy during ramp-up.") shows during the pre-season ramp when spin is set to Really hard or any activity this week was logged as Hard.
- Ranked: safety rows first (Need more fuel when you're under the floor, Watch your cycle, Need more recovery at 7 lift days), shown in yellow and never hidden. Then the most useful others, up to 3 rows in total; the rest behind "{n} more" / "Show less".

---

## 16. Pressed states on everything tappable (native)

Every button, pill, chip, card, row, link and tab gives visible feedback while pressed, even on a quick tap.

- Build one shared component (for example `PressableScale`, wrapping `Pressable` with Reanimated) and use it for every tappable element instead of plain `Pressable` / `TouchableOpacity`.
- Press in: animate to the pressed look in about 80ms. Press out: animate back over about 140ms, so a quick tap is still seen.
- Looks, by kind:
  - Buttons, pills and chips: scale to 0.96 and darken slightly (about 15%).
  - Large surfaces (day cards, workout cards, History rows, "Start workout", "Finish & close"): scale to 0.985 and darken about 10%.
  - Text buttons and icon buttons ((i), close, "+ Add exercise", "2 more"): fade to 60% opacity.
  - Selected pills and switches: brighten briefly as they change.
  - Tab bar: the icon dips to 0.88.
- Disabled elements don't react.
- A drag that turns into a scroll cancels the pressed look (Pressable handles this when it's inside a ScrollView).
- Reduce Motion: no scaling; darken only.
- Pair with the haptics from `docs/HANDOFF-alerts-haptics.md` Part 3: the haptic fires on press, the visual on press-in.

---

## 17. Workout screen and small fixes (native)

- **Rest timer in Liquid Glass:** build the floating glass rest bar from `docs/AUDIT-liquid-glass.md` item 4 now (GlassView in a GlassContainer, −15s / Rest m:ss with Skip / +15s, orange at Go, solid fallback for older iOS and Reduce Transparency).
- **Stretch row:** same height as the other collapsed exercise rows (same padding and one line of text); it was taller.
- **Workout screen header:** back and Swap workout scroll away with the title and come back on scroll up (section 9, updated). The Liquid Glass audit's item 6 (a fixed glass toolbar) is dropped.
- **New exercise note:** "New exercise: starting guess {w} lb from {exercise} at {weight}" (a colon, not " · ").
- **One-off activities:** deleting an activity that was added through "Other" must also remove it from Plan → This week's plan, usual activity days and the Workouts chips (section 8). In the web app this works through `wk.adhoc`: logging from "Other" sets `wk.adhoc[key] = true` and turns the activity on; deleting its last session turns it off again and clears the flag. Test: log Tennis from Other, check Plan shows it, delete it, check Plan no longer does.
- **You → View preferences:** a text button (accent colour, no fill or outline, 44pt tall), not a filled or outlined button.
- **Day and week arrows** (‹ › beside the date): pressed state inverts them (light fill, dark arrow) for at least 140ms, on top of the usual press scale.

---

## 18. Today button in Liquid Glass (native)

- The Workouts "Today" button (top right, next to LIFT BOARD) becomes a small glass capsule: `GlassView` with `isInteractive`, label "Today" in DM Sans 600 15pt, at least 44pt tall.
- When today is already selected it stays visible but dims to 40% and doesn't react (no tint, no press).
- When another day is selected, tint the glass lightly with the Workouts green (#6fd0b4 at low opacity) so it reads as an action. Tapping it moves the day pager back to today (animated when nearby, instant when far).
- It's part of the header, so it scrolls away with the title (section 9) and comes back on scroll up.
- Fallbacks as in `docs/AUDIT-liquid-glass.md`: solid surface colour on older iOS and with Reduce Transparency.

---

## 19. Profile and Settings split (design in progress)

Boards: `docs/design/Proto_Profile.dc.html`, `Proto_ProfileNew.dc.html` (first week), `Proto_Settings.dc.html`. Not ready to build yet; decisions so far:
- You is a profile of what you've done; a gear at the top right opens Settings. Body stats live only in Settings, never on the profile.
- Goal, pace and lifting focus live on Plan → Season (they change mid-season). Lift days and **session length** live on Plan → Week, not in Settings.
- The streak card: flame, then the number, then "weeks in a row" beside the number in Ranchers at a smaller size ("week" when it's 1). No "best streak" line. The card's pink-to-orange background gets stronger as the streak grows (faint at 1 week, full at 16+).
- Later: the weekly report shows the streak ("{n} weeks in a row") when a week is done.
- Hours moved and Most played come from the engine: `hoursMoved()`, `timeByKind()`, `mostPlayed()` (lifts count their logged minutes or session length; activities their minutes). "This season" starts when In-season was last switched (`wk.seasonFrom`), else at your first log.
- **Your year** (a 52-square grid of completed weeks, no subtitle) lives at the top of History → Weeks, not on the profile. Four rows of 13 weeks, labelled Jan, Apr, Jul, Oct on the left. Built in the web app.
- **Session length** is a stepper under Lift days on Plan → Week. Built in the web app.
