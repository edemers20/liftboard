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
  - 5 days: the 4-day split plus Glute volume (Lower), Delts & arms (Upper) or Full A (Balanced).
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
- **Weekly deficit:** target rate × 3,500. Recomp caps the rate at 0.5 lb/week and the cardio share at 25%. Build has no deficit, eats +200, and adds a set to main lifts.
- **Cardio target:** deficit × cardio share.
- **Sources:**
  - Planned sport, climbing, yoga, pilates (3.0 MET, 50-min default class), spin and the pre-season zone 2 session count first.
  - Finishers fill the gap, spread across the remaining lift days, up to the session-length cap.
  - Activity beyond plan shortens later finishers.
- **Food:** whatever the deficit cardio doesn't cover. If activity covers it all, food flips to eating above baseline, which protects muscle.
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
