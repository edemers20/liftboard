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
  - Planned sport, climbing, yoga, spin and the pre-season zone 2 session count first.
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
