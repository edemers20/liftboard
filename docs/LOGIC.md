# Lift Board logic

Every rule the app applies, by layer. Each layer feeds the next. The source of truth is `src/engine.js`; tests are in `tests/engine.test.js`.

## 1. Setup (who you are, what you do)

| Input | What it drives |
| --- | --- |
| Activities | Which tabs and check-in questions exist. Lifting off hides all lift days. |
| Main sport | Seasons, and which support lifts appear in-season. |
| Season | Off-season or in-season split (layer 2). |
| Focus (Lower / Balanced / Upper) | Split choice and where extra sets go. |
| Goal (Deficit only / Recomp / Build) | Food and cardio math (layer 5), set bonuses. |
| Sex, age, height, weight, body fat | Resting metabolism, cardio burn, protein, minimum weight jump. |
| Steps, wearable daily burn | Maintenance (layer 5). |

## 2. Split (which days you get)

- **In-season:** 1–3 full-body days (Full Body A, B, C). 2 sets per lift, no weight increases, support lifts on.
- **Off-season:**
  - 1 day: Full A.
  - 2 days: Full A and B.
  - 3 days: Lower → Lower · Upper · Lower; Upper → Upper · Lower · Upper-pull; Balanced → Full A · B · C.
  - 4 days: the 3-day split plus an Upper pull day.
  - 5 days: the 4-day split plus Glute & hamstring (Lower: sumo deadlift, reverse lunge, lying leg curl, back extension, cable abduction), Delts & arms (Upper) or Full A (Balanced).
  - Days 5–7 never open as copies: each slot defaults to the first exercise in its list that days 1–4 don't already use. Days 1–4 keep their usual defaults. Anything you pick yourself sticks.
- **Off-season full-body days** get +1 set on every lift.
- **Support lifts** show only in-season, and only for your sport:

  | Lift | Sports |
  | --- | --- |
  | Calves | pickleball, running, soccer, volleyball |
  | Adductors | pickleball, soccer |
  | Rotator cuff | pickleball, volleyball, climbing |

## 3. Weekly adjustments (sets per lift)

Applied per slot, in this order:

1. **Deload week:** about 60% of sets, roughly 90% weights, easy-pace finishers. It is suggested after 6 off-season weeks, or when 2+ main lifts stall (no gain in weight or reps over 3 sessions).
2. **Session length:**
   - 30 min: main lifts + 1 accessory, no finisher.
   - 45 min: optional accessories cut.
   - 60 min with no supersets: optional accessories cut.
   - 75 min: +1 set on main lifts.
3. **Focus:**
   - Lower: +1 on lower accessories, −1 on upper accessories.
   - Upper: the reverse.
4. **Recovery load** (layer 4), at the day level.
5. **Goal:** Build adds +1 set on main lifts.
6. **Sport load:**
   - 120+ leg-sport minutes: −1 unilateral set.
   - 180+ leg-sport minutes: −1 quad set.
   - 120+ shoulder-sport minutes: rear delts +1, side delts −1.
7. **Classes:**
   - Hard spin: −1 quad set.
   - Climbing: −1 vertical-pull set and arms skipped. At 2+ sessions, lats skipped too.
8. **Floors:** main lifts keep at least 2 sets; everything else keeps at least 1.

## 4. Recovery load (how hard this week can be)

Score = sum of:

| Factor | Points |
| --- | --- |
| Low readiness | 2 |
| Soreness | 1 (2 if everywhere) |
| Drinking 1–2 nights | 1 |
| Drinking 3+ nights | 2 |
| Period or luteal phase (female / other) | 1 |
| Heavy sport week (240+ leg-sport min) | 1 |
| Hard spin | 1 |

**Daily modifiers:** Rough adds 5. Good subtracts 1. A rep drop on the last session adds 2 to the next day.

| Score | Effect |
| --- | --- |
| 2 | Finishers switch to easy pace (no intervals). |
| 3–4 | Also: main lifts −1 set, no weight increases. If you're sore in one area, the cut hits that area's main lift. |
| 5+ | Shortened day: −1 set on everything, optional accessories skipped. |

**Fatigue:** if reps drop on 2+ lifts in a session, the next day is shortened automatically. Two hard sessions in a row suggest a rest day.

## 5. Food and cardio

- **Maintenance:**
  - Without a wearable: resting (Mifflin-St Jeor, or Katch-McArdle with body fat) × 1.1, plus steps, plus lifting days × avg lift kcal / 7, plus cardio, plus digestion (1/9).
  - With a wearable: the wearable's daily burn × 0.93.
  - Calibration (below) is added on top.
- **Weekly deficit:** target rate × 3,500. Lose fat, keep muscle caps the rate at 0.7% of body weight a week (≈1.0 lb at 138 lb) and the cardio share at 25%. Default stays 0.5 lb/week. Build has no deficit, eats +200, and adds a set to main lifts.
- **Cardio target:** deficit × cardio share.
- **Sources:**
  - Planned sport, climbing, yoga, pilates (3.0 MET, 50-min default class), spin and the pre-season zone 2 session count first.
  - Finishers fill the gap, spread across the remaining lift days, up to the session-length cap.
  - Activity beyond plan shortens later finishers.
- **Food:** whatever the deficit cardio doesn't cover. If activity covers it all, food flips to eating above maintenance, which protects muscle.
- **What to act on:** *Rest-day burn* is maintenance minus all training (lifting and cardio), so it only moves with body data or steps. *Eat below (or above) a rest day* = daily food minus rest-day burn; it moves whenever training changes, so it's the number to set eating habits by. The Goal card also shows the change vs last week's food (per day and per week), and change toasts read "Eat N more a day, N×7 a week".
- **Calibration:** after 3+ weekly weigh-ins, the last 6 weeks of weight are regressed against intake. Maintenance is corrected by up to ±400 kcal.
- **Protein:** 0.8–1.0 g per lb (0.7–0.9 on Build).
- **Floors:** a warning shows if intake drops below 1,500 kcal (1,800 for male).

## 6. Progression (next weight)

Per lift, from your last logged set:

| Result | Next time |
| --- | --- |
| Hit the top of the range (isolation: top + 3) | ↑ Weight up: lower main lifts ~5%, upper ~2.5%, accessories ~5%. |
| Inside the range | = Same weight, one more rep. |
| Under the bottom twice at the same weight | ↓ Rebuild at −10%. |
| 3+ reps past the top | ⇈ Double jump. |
| Reps fell 4+ from first to last set at the same weight | ! Fatigue: same weight, rest longer. |

**Jump sizes:**
- Minimum jump is 5 lb (10 lb for men on lower main lifts).
- Dumbbells step 2.5 lb at 20 lb and under.

**Holds:**
- Weights stay the same in-season and when recovery load is 3+.
- Deload uses 90% weights.

## 7. Days and weeks

- A day marks itself done when every lift's planned sets are ticked. This logs history, checks fatigue and stores the next-time review.
- **Start new week:**
  - Snapshots the week (lifts, sport minutes, cardio, weight, intake).
  - Plans missed days: Recomp and Build continue from the missed day; Deficit only resets to Day 1.
  - Runs calibration.
  - Resets the check-in.

## 8. Feedback

- Plan changes show as a toast, and only when something actually changed.
- A Today switch shows what changed for that day.
- Completion sheets appear after setup, after each day and at week's end.

## Session tools (added)
- **Rest timer:** 2:00 after main lifts, 1:15 after everything else. −15s / +15s on the running timer adjusts it and is remembered per exercise (30s–5:00). It runs from a saved end time, so locking the phone doesn't pause it; on return it shows the real time left or how long you've been over (up to 5 min).
- **Workout timer:** starts on the first ticked set of a day, stops when the day is marked done. Shown under the day title and on the Day done sheet.
- **Easy / tough set nudge:** after a ticked set, reps at least 2 above the top of the range suggest going up one increment for the remaining sets; reps below the bottom suggest dropping one increment. Dismissable; "Use" fills the remaining sets' weight.
- **Starting weight:** with no history, the weight dial starts from an equipment-based guess (barbell 95 main / 65 accessory, dumbbell 30 / 20, small-muscle dumbbell 10, cable 40, machine 90 / 60, bodyweight 0). Later sets start from the set before.
- **Rep target:** the reps field shows today's target; ticking a set without reps logs the target.
- **Unilateral starting side:** single-side exercises show "Start on Left/Right", defaulting to the opposite of last session's start; the side is saved with that session's history.
- **Finishing a day:** happens automatically only when every non-skipped lift set and the cardio finisher are done. Set logs stay visible until a new week; editing a finished day rewrites that day's history entry; reopening a day removes it.
- **Two in-season sports:** a primary and an optional second sport. Support lifts cover both; the season sentence names both. Tapping a picked sport again makes it primary; tapping the primary removes it.
- **Stretching:** optional cooldown block on lift days (lower, upper or full-body set), toggled in Training preferences; never required to finish a day.
- **Lifting days:** 0 is allowed and removes lift day tabs.
- **Up to 7 of anything:** lift days and every activity go to 7 a week (in-season lifting stays capped at 3 full-body days). Days 6–7 add full-body sessions and run 1 set lighter on every lift.
- **Packed weeks:** total sessions = lift days + all activity sessions + the ramp session. 10–12 adds 1 to recovery load, 13+ adds 2. 4+ spin classes add 2 instead of 1.
- **Flags (Watch):** 6 or 7 lift days (rest-day warning), any sport or climbing at 6+ a week (near daily), 10+ sessions (stack activities on lift days), 14+ sessions (expect strength to hold, not climb).

## Muscle priorities and weekly balance (added)
- **Slot → muscles:** every slot maps to the muscles it trains. Direct work counts 1 set, helper work ½ (rows: back 1, biceps ½, rear delts ½; presses: triceps ½ plus chest or side delts; hip hinges: hamstrings 1, glutes ½; and so on). Generic "Arms" slots count by the chosen exercise (curl → biceps, pushdown/extension/dip → triceps).
- **Priority (0–7) per muscle, for any setup:** base (glutes, quads, hamstrings, back, chest 3; adductors, side delts, rear delts, core 2; calves, cuff, biceps, triceps 1); focus adds +2 to its group (+1 for calves or arms); Build adds +1 to the focus group; every active sport adds what it demands: shoulder/overhead sports (pickleball, tennis, volleyball, golf) rear delts +2, cuff +2, core +1; leg sports calves +1, adductors +1, and running/soccer/hockey hamstrings +1; climbing rear delts +1, cuff +1, back −1, biceps −1; pilates or yoga core −1.
- **Trimming by priority:** when a day has to be cut (45-min sessions, supersets off at ≤60 min, a shortened day), the number of cuts stays the same as before but the lowest-priority accessories go first. A 30-min session keeps the highest-priority accessory.
- **Weekly target per muscle:** 10 / 8 / 6 / 4 / 2 sets for priority 5+ / 4 / 3 / 2 / 1 (×0.6 in-season or in a deload week), capped at what the week's plan can deliver.
- **Ledger:** sets ticked this week (any day) plus sets still required on unfinished days.
- **Behind** (only after something was skipped on a finished day): later days first get back an exercise for that muscle that was trimmed for time, then one catch-up set on a remaining exercise for it.
- **Covered:** a single-muscle isolation exercise on a later day becomes optional when its muscle is priority 2 or lower, has had work this week, and would still reach 125% of target without it.
- **This week** shows each muscle's done / target and status (done, on track, behind).

## Fat-loss pace guardrails (added)

- **Pace bands** (shown under the rate on Season): ≤0.5% BW/week = room to keep building; 0.5–0.7% = hold muscle; >0.7% = strength likely slips, keep it short. Only Lose fat fast can go past 0.7%.
- **Energy floor (all fat-loss goals):** intake never drops below 30 kcal per kg of lean mass plus the day's exercise (lifting days × lift kcal / 7 + all cardio / 7). Lean mass uses body fat if entered, otherwise 28% (female), 18% (male), 23% (other). If the plan would go under it, food comes up for the week and a note gives the slower expected loss.
- **Watch notes when pace > 0.5% BW:** expect to hold rather than build (Lose fat, keep muscle); a late, missed or changed period is a sign to slow down (female/other); reps dropping in the last session suggests easing the rate.
- **Time limit:** each finished week records whether it ran fast. After 8 fast weeks in a row, a note suggests a few weeks at Maintain.

## History tab (added)

- **Position:** first tab (after setup is done).
- **Session log** (`wk.sessions`, kept across weeks, last 500): finishing a lift day logs `{t, k:"lift", id, title}`; reopening the day removes it. Entering an activity's actual minutes logs `{t, k:<activity>, min}`; clearing the minutes removes it. Activities left at their planned minutes aren't dated, so they don't appear.
- **Backfill:** on first load, past lift days are rebuilt from lift-history timestamps (titles unknown, shown as "Lift").
- **Calendar view:** "How often" averages sessions, lifts and activities a week over the last 8 weeks (or since the first session), plus a bar per weekday showing how many of those weeks had a session that day (green if a lift, pink if only an activity). Below it, a month calendar with a dot per session; tap a day to see what you did.
- **Weeks view:** the weekly snapshots, moved from Season.
- **Lifts view:** main lifts with sparklines, moved from Season.

## Cuts, rest, added exercises, summaries (added)

- **On a cut** (Lose fat fast, or any fat-loss pace over 0.5% of body weight a week): missing the rep range keeps the weight ("hold the weight · holding is the win on a cut"); only three misses in a row at the same weight ease it 5%. Not on a cut, two misses still drop 10% ("rebuild"). An accessory that missed its range last time loses one set before any weight comes off. A Goal note says holding is the goal. Adding weight at the top of the range is unchanged.
- **Rest:** main lifts 2:30 (3:00 at ≤5 reps), other compounds 1:30, isolation 1:15; +15s for one-side work; +30s after the first set of a main or compound lift; 20s after the first half of a superset. ±15s on the bar sets that exercise's base. Old per-exercise tweaks were reset once when this changed. A chime plays when rest ends (Training preferences → Rest timer sound); vibration stays as backup.
- **Added exercises:** "+ Add exercise" at the end of a lift day. Pick from the list (grouped by area) or type a custom name and choose what it counts as (guessed from the name). The category sets the slot label (so the weekly muscle ledger counts it), the rep range and progression. Added exercises sit after the day's lifts and before the cardio finisher, are never trimmed or marked covered, and are cleared when a new week starts. Remove is available until a set is ticked.
- **Day done report:** each exercise with its top set (heaviest, then most reps) and the next-time arrow (↑ up, = held, ↓ ease).
- **History calendar:** tapping a day lists each workout's exercises with top sets (older days rebuilt from lift history).
- **Next-time notes carry over:** finishing a day saves a note per exercise (`wk.next`); it shows on that exercise the next time you do it ("Go up to 150 lb · ~6 reps"). Reopening the day removes its notes.
- **Tweaks:** Lifting days live only on This week (setup still asks). Tap an open exercise's header to collapse it. The calendar day detail is titled with the workout (e.g. "Hinge & Glute") and scrolls into view.
- **Bodyweight exercises:** added across every category (push-ups, dips, pike push-ups, air/jump/sissy squats, wall sit, bodyweight lunges and split squats, skater/pistol squats, glute bridges, frog pumps, donkey kicks, clamshells, fire hydrants, Nordic curls, planks, hollow holds, leg raises and more), appended so no existing default changed. For these the weight field is added load: blank means bodyweight, and a set counts with reps alone. Progression goes by reps; at the top of the range it suggests another rep, a slower lowering or 5–10 lb; with added load already, +5 lb. Shown as "BW × 12" or "BW+10 × 8".
- **Yoga and pilates effort:** Light / Moderate / Hard per activity (default Moderate). Yoga MET 2.3 / 3.0 / 4.0 (+1.0 heated); pilates 2.5 / 3.0 / 4.3. Light classes don't count as core work, so core accessories aren't eased for them.
- **Revision (Nov 6):** superset 20s transition only once you're alternating (the partner has a ticked set); straight sets get full rest. Optional (trimmed/covered) exercises sit in an "Optional" group after the required ones. First-time exercises get a starting guess from the most recent related exercise in the same movement list and equipment (one-arm/one-leg ≈ 55% of two; ×0.9, rounded down). Next-time messages shortened ("hold", "hold · fine on a cut", "2/3 sets"). Sound: iPhone playback mode + unlock on first tap; "Play test sound" in Training preferences.
- **Units (Nov 6):** Season → Units: lb or kg. Everything is still stored and calculated in lb; kg is display and input only (inputs, dial, and a pass that rewrites "150 lb" as "68 kg" anywhere it renders). kg rounds to 0.5.
- **Food card (Nov 6):** shows "Eat today: X kcal" and "Your base is Y" (rest-day burn: BMR + daily movement + steps + digestion). Workout and activity burn is in the math but not shown as a number; stats are weekly deficit and expected loss.
- **Rest levers (Nov 6):** compound and main lifts get +15s each for a cut, in-season, or low recovery (rough day, low readiness or full-body soreness), capped at +30s; never shorter. The rest bar names the reason ("Rest 2:45 · +15s · cut").

## Navigation and scheduling (Workouts · Plan · History · You)
- Bottom nav: **Workouts** (home), **Plan** (Week / Season), **History**, **You**. Lift days and activity screens open on top of Workouts with a back link; the nav hides there so the rest timer has room.
- **Lifts are an ordered queue** on your usual lift days (`wk.ldays`, Monday = 0). Dates are projected from the queue, never stored. A lift done today removes today's slot; lifts that don't fit show as "Doesn't fit this week". Next week's view continues the rotation.
- **Activities are weekly counts**, logged on any day from Workouts ("Log activity"). Logging past the planned count raises the count.
- **Weeks start on their own** on Monday or Sunday (`wk.wkStart`). The first open after the boundary runs `newWeek(start)`; leftover lifts carry the rotation forward on every goal (the old Lose-fat-fast restart is gone).
- **Next-morning check** (`wk.remind`, default On): if yesterday has nothing logged and activities are still open, Workouts asks "Did you play or train yesterday?" and logs it on yesterday's date.
- **Swap offer:** a leg-heavy sport logged today with a Lower day queued offers the next Upper day instead.
- **Check-in** sits at the top of Plan until saved, then becomes one line at the bottom. `newWeek` reopens it.
- **Pace** is stored as % of body weight a week (`wk.ratePct`); lb/week = % × current weight (`rateLb()`). Options: Lose weight fast 0.5 / 0.75 / 1%; Lose fat, keep strength 0.25 / 0.5 / 0.7%. Old lb paces convert to the nearest option once.
- Goal names: Lose weight fast · Lose fat, keep strength · Maintain · Build muscle. Definitions live behind "Goal definitions" on Plan → Season.

## Onboarding
- Welcome (new users only) → Plan your week → As much help as you want (level slider, demo only) → six setup steps: sport and season, goal (definitions inside each option), usual lift days + weekly activity counts, extra focus, bio (sex, age, height, weight, optional body fat), You're set (first workout, then the rest of the week faded in at 45%).
- Shows once: finishing or skipping sets `wk.onbDone`; Replay tour on You opens it again. Answers start from current settings; Skip (shown once set up) leaves everything as is. Finishing writes the answers to settings; logs and history are untouched.
- **Move to today** pins that lift to today (`wk.pinToday`, today only); the rest of the queue keeps its order on the remaining usual days, so the day it left takes the next lift.
- **Log activity → Other** lists every activity you haven't turned on; logging one turns it on.
- Yoga and Pilates can be your main activity. They have no season, so the in-season switch is hidden for them.
- **Usual activity days** (`wk.adays`, Monday = 0) replace the per-activity count inputs on Plan. They mark days on the Workouts strip (pink outline) and give planned activities in "This week's plan" a day, in order; without them activities say "Any day". Which activity is up to you.
- **Experience** (`wk.level`: new / some / years) is a setup step and a Training preferences setting. For now it sets tips: Years of lifting → Fewer tips, otherwise More guidance. The "As much help as you want" slider is a demo only; it plays on its own until touched and saves nothing.
- **History → Week Breakdown** (replaces "How often"): stacked bar per week, last 8 weeks, of hours on Lifting / Sport / Classes / Cardio. Lifts now save their duration (timer start to Day done, rounded to 15 min, min 30); older lifts count as the session length setting. Activities use logged minutes.
