# Lift Board: product and design context

Read this before any feature work. It explains **why** the app works the way it does, so you can make small calls without asking and know which calls you shouldn't make. The rules files in `.cursor/rules/` say what to do; this says why. For what's left to build, read `docs/OUTSTANDING.md`.

Updated Nov 16, 2026.

---

## 1. What Lift Board is

Lift Board plans a person's whole training week, so they don't have to think about programming. It takes three things: their goal, the activities and sports they already do, and how they feel. From those it writes the lifting workouts, fits them around everything else, and sets a daily fuel target and a recovery read.

**The core promise:** open the app, see what to do today, do it, log it in as few taps as possible, and trust that next week adjusts.

**Who uses it now:** Emma (the founder, an experienced lifter who plays pickleball) and a few friends on the web app. The native iOS app is in a dev build on Emma's phone, heading to a TestFlight beta for 3 to 5 people.

**What it isn't:** a social app, a coaching marketplace, a calorie tracker or a medical tool. No payments, ads or data sales; it's free.

## 2. Two apps, one engine

- **Native app** (`apps/mobile`, Expo / React Native, iOS first) is the product going forward.
- **Web app** (`src/`, vanilla JS + Vite, live on GitHub Pages) is what friends use today and the working reference. When behaviour is unclear, match `src/main.js`.
- **The engine** holds every rule (splits, sets, progression, rest, fuel, recovery, PRs, streaks). It lives in `src/engine.js` (web) and `packages/engine` (native) and the two must stay in step. A rule change goes into both, with a test in both (`tests/` and `packages/engine/tests`).
- **Parity:** a change Emma asks for in one app goes into the other unless it's platform-only (Liquid Glass, notifications, haptics, Live Activity, swipe gestures have web stand-ins). When you finish native work, list the web changes it needs, and make them if asked.
- Everything works offline. The plan is computed on the phone; a backend (Supabase) will only store inputs and logs, later.

## 3. How Emma works with you

- Emma is a product designer, not an engineer. She tests on her phone and gives feedback in plain words. Explain what you changed in terms of what she'll see, not file names.
- **Her copy is final.** Use her wording exactly, including capitalisation and punctuation. Never "tighten" or rephrase it. If a screen needs words that don't exist yet, write a placeholder marked `TODO copy` and list it; don't invent final copy.
- Voice rules (also in `copy.mdc`): no em dashes (use semicolons), no Oxford comma, never "genuinely", avoid "[clause]: [clause]" in sentences.
- Don't add process rules she didn't ask for (for example, no rule to auto-commit or auto-push).
- When something is ambiguous and expensive to redo, ask. When it's cheap, make the call and say what you chose.
- She'll often save and sync from Cursor's Source Control panel; changes made elsewhere (by Claude) arrive through `git pull`. Pull before starting.

## 4. Navigation

Four tabs, in this order: **Workouts** (home), **Plan**, **History**, **You**. Each has a theme colour.

| Tab | Theme | Job |
| --- | --- | --- |
| Workouts | green | Today: what to do, start it, log activities. A day pager you swipe through. |
| Plan | orange | The week (check-in, the plan, changes, watch, fuel and recovery, lift days, session length) and the season (goal, pace, focus). |
| History | orange | Calendar, Weeks (streak, Your year, past weeks) and Lifts (PRs, trends, 1RM). |
| You | pink | A profile of what you've done. The gear opens Settings. |

Activities (pickleball, yoga and so on) use pink wherever they appear.

## 5. Product decisions and the reasoning

### Planning
- **Lifts are an ordered queue**, placed on your usual lift days. Miss one and the queue slides; you never "owe" a workout. Future dates are projected, never stored.
- **Activities are logged whenever they happen**, not scheduled. The plan reacts to what you actually did (a hard pickleball session the day before a leg day offers a swap).
- **New weeks start on their own** (Monday or Sunday). Marking a week done early rolls it now.
- **Anything that changes during a season lives on Plan → Season** (goal, pace, lifting focus). Anything you set once lives in Settings. Lift days and session length are weekly decisions, so they're on Plan → Week.
- **After a week ends, you can choose which lift to start with** by swapping the first lift with any other unstarted lift that week. It changes this week's order only.

### Workouts
- **Logging should take one tap per set.** Weights and reps pre-fill from the engine; you tick the set. Everything else (rest, next-time weights, PRs) follows from that.
- **Opening a workout only views it.** It becomes the live workout when you log the first set. Only one workout is live at a time.
- **Rough mid-workout only changes what's ahead.** Logged work is never removed by a later choice.
- **Weight suggestions ask once.** If you say Keep, the app remembers for that exercise in that workout.
- **Optional is never done by default.** A check means something was logged.
- **Rest timer:** counts down, then reads Done and stops at zero. It doesn't count up or nag.

### Records, streaks and progress
- **A PR** is a heavier top set, or more reps at the same or a heavier weight, compared with every earlier session of that exercise. Bodyweight work counts added load or more reps. Never on the first session of an exercise. One record per exercise per week. One shared rule (`prsBetween`) feeds History, the weekly report, the share card, the profile and the Day done card.
- **A completed week** means every planned lift was done, or you counted it yourself. The streak counts completed weeks in a row.
- **Celebrate earned things only.** No "3 more to unlock", no locked milestones, no "best streak" line that makes the current streak look small. Missed weeks show as faint flames, not gaps or red marks.
- **Holding strength on a cut is a win.** Copy and colour shouldn't treat flat as failure.

### Profile and Settings (Nov 14)
- You is a profile of what you've done: streak, totals, strongest lift, PRs, most played, milestones. It should feel like a reward to open.
- **No body stats on the profile.** Weight and body fat are private and change daily; they live in Settings → Body.
- Every empty spot in the first week says what fills it, or offers the step that fills it.

### Fuel and recovery
- Fuel (calories) is called **fuel**, never diet or eating. It's a daily target, not a log.
- Lifting calories are estimated weekly from your actual sessions (MET 5 by default), not a fixed number.
- Recovery reads from what you did and how hard (effort on activities). Hard sessions add recovery load.
- On Workouts, the Fuel & recovery card sits last: the day's training comes first.

### Plan → This week's changes and Watch
- Shown as short headlines with detail on tap, in Emma's wording. Safety notes first.
- A change shows the week it happens, then becomes part of the plan and stops showing.

## 6. Design decisions

The full system is in `.cursor/rules/design.mdc` and the boards in `docs/design/`. The reasoning behind the parts people ask about:

- **Ranchers** for titles and big numbers, **DM Sans** for text, **DM Mono** for every number a person reads or types.
- **Workout titles use parentheses:** "Lower (Glute & Hamstring)". Day labels use a colon: "Day 4: Push". Added exercises: "Added (Main Glute)". No middle-dot bullets in these.
- **Weights:** "@ 115lb" inline, "Overhead Press (Barbell): 30lb x 8" for next-time lines. No space between number and unit in these two formats.
- **Liquid Glass is for what floats above content** (tab bar, Today button, rest bar, live workout pill, sheets), never for content (cards, tiles, charts). No glass on glass. Respect Reduce Transparency with the solid surface colour. See `docs/AUDIT-liquid-glass.md`.
- **Pressed states on everything tappable**, visible for at least 140ms, so taps feel registered.
- **Headers scroll away** on scroll down and return on scroll up; content runs under the status bar.
- **First-run tab tips** appear once per tab, in Emma's wording.
- **Motion:** tabs and switches slide in tab order; the day pager follows your finger; the Day done card and milestones pop in. Reduce Motion gets fades.
- **Lifting is green, activities pink, fuel and records orange.** The sets picker and anything about lifting stays green.

## 7. Decided against (don't add back without asking)

- A fixed Liquid Glass toolbar on the workout screen (the header scrolls away instead).
- Body stats on the profile.
- A "best streak" line on the streak card.
- Locked or upcoming milestones.
- Payments, ads, social sign-in, passwords.
- Not yet: blank workouts, injured or sick check-ins, HealthKit, Android.

## 8. Health and privacy

Weight, body fat, cycle notes and workouts are health data. Never send them to logs, analytics or error reports. The "not medical advice" line stays visible in Settings.

## 9. Where things are

| Need | File |
| --- | --- |
| What's left to build | `docs/OUTSTANDING.md` |
| Every rule | `docs/LOGIC.md` |
| Every screen | `docs/SCREENS.md`, `docs/screens/`, boards in `docs/design/` |
| Every word | `docs/COPY.md` → `apps/mobile/src/copy.ts` |
| Feature specs, in order | `docs/HANDOFF-nov-13-features.md` (sections 1–21) |
| Notifications, Live Activity, haptics | `docs/HANDOFF-alerts-haptics.md` |
| Liquid Glass | `docs/AUDIT-liquid-glass.md` |
| Icons | `docs/ICONS.md`, `assets/icons/` |
| Backend (later) | `docs/BACKEND-SUPABASE.md` |
