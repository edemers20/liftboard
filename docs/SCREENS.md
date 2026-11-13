# Lift Board screens

Every screen in the app, what it shows, its states and where it goes. Pictures of each are in `docs/screens/` (file names in brackets). The web app in `src/main.js` is the working reference for behaviour; exact wording is in `docs/COPY.md`.

Navigation: a bottom tab bar with **Workouts · Plan · History · You**, shown on every screen except onboarding and an open workout. Switching tabs slides in tab order.

---

## 1. Onboarding (first launch only; "Replay tour" on You opens it again)

Shown once, before the tabs. A progress bar of dots at the top; Back and Next at the bottom. Returning users see a Skip button.

| Step | Shows | Picture |
| --- | --- | --- |
| Welcome | "Welcome!", a short note signed Emma, Get started | `01-onboarding-welcome` |
| Plan your week | Title, one line, three cards that slide in from the right one after another (What to lift today · Fits around everything else · Fuel and recover). Each card has a small animated example ("Last: 135 × 8 ✓ → Today: 140 lb"); in each, the cause pill fades first and the result pill follows a beat later | `02-onboarding-plan-your-week` |
| Level demo | "As much help as you want": a three-stop slider that glides to each stop on its own (and when dragged, settles on the nearest stop); one sample workout card changes as it moves (tips and reasons for Beginner, bare targets and swaps for Advanced) | `03-onboarding-level-demo` |
| 1. What do you do? | Sport pills (Pickleball, Tennis, Running, Biking, Soccer, Volleyball, Climbing, Golf, Hockey, Rugby, Yoga, Pilates, None); "In-season now" switch for seasonal sports | `04-onboarding-1-sport` |
| 2. What are you training for? | Four goal cards with a one-line definition each; pace is set later | `05-onboarding-2-goal` |
| 3. Which days do you usually lift? | Mon–Sun day toggles; other activities with − / + counts per week | `06-onboarding-3-days` |
| 4. Where do you want extra focus? | Lower body · Balanced · Upper body pills | `07-onboarding-4-focus` |
| 5. How long have you been lifting? | Beginner · Some Experience · Advanced cards with descriptions | `08-onboarding-5-experience` |
| 6. A bit about you | Sex pills; Age, Height, Weight, Body fat (optional), Daily steps inputs | `09-onboarding-6-about-you` |
| 7. You're set | The first workout card plus the rest of the week fading in | `10-onboarding-7-first-workout` |

From step 1 on, a "Plan so far" card at the bottom updates live. Finishing writes every answer into settings and **replaces** the activity list with exactly what was picked.

---

## 2. Workouts (home tab)

[`20-workouts-today`, `21-workouts-past-day`]

- Header: LIFT BOARD title; a Today button (disabled when today is selected).
- Week strip: seven day cells with a dot per item (green lift, pink activity); arrows to the previous/next week; today ringed; selected day filled.
- Day line: ‹ "Today · Saturday, Nov 7" ›.
- Swiping: anywhere below the week strip, swipe left/right to change day (the cards slide). On the M–Sun strip itself, swipe left/right to change week.
- Day cards:
  - **Today, lift planned**: workout title, exercise list with targets, Start workout; "Switch to …" link when relevant.
  - **Completed lift**: whole card is tappable and opens the workout with a card-to-page transition.
  - **Planned (future) lift**: Move to today.
  - **Open day (today or future, nothing planned)**: "Nothing planned" + "View next lift".
  - **Past day, nothing logged**: "Rest · Nothing logged".
  - **Activity logged**: pink card with minutes; tap to edit minutes or delete.
  - **Usual activity day**: a reminder card.
- Activity chips: one pill per activity with "0 of 2" progress, plus "Other" to log anything. Only on today and past days of this week.
- Fuel & recovery card (today only): Fuel today kcal; Lower body and Upper body recovery ("18h rest" or "Ready"). Taps through to Plan.
- Banners: next-morning check ("Did you play or train yesterday?") when yesterday is empty and the setting is on.

## 3. Workout (a lift day)

[`23-workout-lift-day`, `24-workout-rest-timer`, `22-workout-completed`]

- Back link "Back", which returns to the page that opened the workout. Then the workout title and a running timer once started.
- "How do you feel today?" slider: Thriving · Normal · Rough (stored values Good / Normal / Rough).
- Exercise cards in order; the current one is expanded and outlined, others collapsed with a chevron. Each card: slot label, set count badge ("Set 2 of 4"), progress bar, exercise picker, rows of weight × reps with a ✓ per set, "+ Set".
- Ticking a set starts the rest bar at the bottom: −15s zone, "Rest 2:59", +15s zone, Skip. It chimes at zero (local notification when the phone is locked).
- Optional cardio finisher at the end.
- Finishing shows a "Day done" summary (sets, ups, holds, next-time weights).
- Completed workouts open read-only with exercises struck through.

## 4. Activity

Opened from an activity card. Minutes done (and a setting such as intensity for spin), edit or delete.

---

## 5. Plan tab

Header: the week's date range as a page title ("NOV 2 – 8") or "SEASON"; a Week / Season switch. Switching slides.

### Week [`30-plan-week`, `31-plan-week-checkin`]
1. **Weekly check-in** (only until saved for the week): Readiness, Soreness, Cycle (female only), Drinking nights, Avg weight, Save check-in. Once saved it collapses to a line at the bottom: "Check-in · Feeling normal, no soreness" with a pencil to edit.
2. **This week's plan**: one row per lift and activity with a status icon (done, next, open); tap opens it. Then "Lift days" and "Activity days" (no count) Mon–Sun toggles.
3. **Fuel/Recover** with an (i) whose tip is "How this is calculated": Fuel today kcal, recovery tiles; tiles for Your base, vs last week, Expected loss.
4. **This week's changes** and **Watch** lists, each with an (i).

### Season [`32-plan-season`]
- "Your plan" sentence with underlined values (sport, season, lift days, focus, goal, fuel, protein, cardio).
- Season: In-season, Season starts in ≤6 weeks, Deload this week (switches).
- Goal pills with "Goal definitions"; Pace as a scrolling number picker in lb (or kg) a week, up to 1% of body weight (0.7% for recomp), with the % of body weight under it (shown for fat-loss goals); Lifting focus pills.

---

## 6. History tab

Calendar · Weeks · Lifts switch (slides between them).
- **Calendar** [`40-history-calendar`]: month grid; days filled green (lift), pink (activity) or split; tap a day for its details. Week Breakdown (minutes of lifting vs activities per week).
- **Weeks** [`41-history-weeks`]: one card per past week; empty state "A new week begins on its own."
- **Lifts** [`42-history-lifts`]: main lifts with top-set trend sparklines.

---

## 7. You tab

[`50-you`, `51-you-edit-profile`]
- Profile header: initial in a gradient circle, name, "Member since Aug 2026", a pill for each sport and activity (main sport first), stat tiles Lifts / Activities / Weeks active.
- Profile grid in view mode shows only Goal, Experience, Lifting focus and Lift days. "View preferences" opens the rest, already editable: activities, sports in season, focus, bio data (including height, weight, body fat, steps, age and sex) and training preferences (experience slider, session length, supersets, stretching, rest timer sound with Play test sound; no lift kcal field, it is worked out weekly). "Save & close" sticks above the tab bar when something changed; otherwise the button says "Close".
- App: Units (lb / kg), Tips (More / Fewer), Week starts on (Mon / Sun), Next-morning check (On / Off) as two-way switches. Stays under preferences.
- FAQ: 15 expandable questions, no disclosure mark. Stays under App.
- Your data: in the native app this becomes Export my data and Delete account (replacing Download / Restore backup).
- Disclaimer line; Replay tour; Reset profile.

---

## 8. New in the native app

- **Sign in**: email field, then a 6-digit code screen; "Resend code".
- **Import a Lift Board backup**: one-time, after first sign-in; shows what was found (lifts, activities, weeks) before importing; notes that set history is top sets only.
- **Account**: signed-in email, Sign out, Export my data, Delete account (with a confirm step).
- **Error states**: offline banner, "Couldn't sync" with retry, signed-out screen.
