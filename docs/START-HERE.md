# Start here: building Lift Board in Cursor

Everything Cursor needs is already in this repo:

- `.cursor/rules/` — four rules files Cursor applies to every request (product, engine, design, copy)
- `docs/SCREENS.md` — every screen, its states and navigation
- `docs/screens/` — a picture of each screen from the current app
- `docs/COPY.md` — every word in the app
- `docs/ICONS.md` and `assets/icons/` — the icon set, and Lucide for anything new
- `docs/HANDOFF-alerts-haptics.md` and `docs/HANDOFF-nov-13-features.md` — the next things to build, with designs in `docs/design/`
- `docs/LOGIC.md` — how every rule works
- `docs/BACKEND-SUPABASE.md` — the backend plan
- `src/engine.js` and `tests/` — the rules engine and its 67 tests, which move into the new app unchanged

You don't write code yourself. You give Cursor one clear task at a time, check the result on your phone or the Simulator, and save it.

---

## Step 1: Save your data (5 minutes, do this first)

Your history lives only in the browser where you use the web app.

1. Open the web app on the phone you use it on.
2. You → Your data → **Download backup**.
3. AirDrop or email the file to your Mac and keep it somewhere safe. You'll import it into the new app later.

## Step 2: Install the tools (about an hour, mostly waiting)

On your Mac:

1. **Cursor**: download from cursor.com and sign in.
2. **Node.js**: download the LTS version from nodejs.org and install it.
3. **Xcode**: install from the Mac App Store (it's large). Open it once and accept the prompts; this also installs Git.
4. **Apple Developer Program**: start enrollment at developer.apple.com/programs. It can take a few days, so start now; you need it later for TestFlight.

## Step 3: Open this repo in Cursor

1. Open Cursor and choose **Clone repo**.
2. Paste `https://github.com/edemers20/liftboard` and pick a folder (for example Documents/Code). If it asks you to sign in to GitHub, use the account that owns the repo.
3. Cursor opens the project. Open `docs/START-HERE.md` (this file) inside Cursor so it's easy to follow along.
4. Check the rules loaded: Cursor Settings → Rules. You should see product, engine, design and copy.

## Step 4: Work in small tasks

Open the Agent chat (the AI panel), paste one prompt below, and let it work. Then:

- **Read what it changed.** Cursor shows each file's changes; accept them if they look reasonable.
- **Run it** and look at the screen next to its picture in `docs/screens/`.
- **Tell it what's wrong** in plain words ("the day cards should slide left when I swipe left"). Point at the picture.
- **Save your progress** when something works: the Source Control panel → type a short message → Commit → Sync. That's your undo point.
- Start a **new chat for each task**, so it doesn't drag old mistakes along.

### Prompt 1: the skeleton

> Read every file in `.cursor/rules/`, plus `docs/SCREENS.md` and `docs/BACKEND-SUPABASE.md`. Then set up the project, without building any screens yet:
> 1. Create an Expo app in `apps/mobile` with Expo Router and TypeScript.
> 2. Create `packages/engine` containing a copy of `src/engine.js` and the tests from `tests/`, and make `npm test` pass there with all 67 tests. Don't change the engine's code.
> 3. In the app: four tabs (Workouts, Plan, History, You) with placeholder screens; load the Ranchers, DM Sans and DM Mono fonts; a theme file with the colours and radii from `design.mdc`.
> 4. Storage with react-native-mmkv wrapped as `{getItem, setItem}`, passed to the engine's `init()`, and a Zustand store around the engine as `engine.mdc` describes.
> 5. Tell me the exact commands to run it in the iOS Simulator.
> Leave `src/` (the web app) untouched.

Run the commands it gives you in Cursor's terminal (Terminal → New Terminal). The Simulator opens with your four empty tabs.

### Prompts 2 to 8: one screen per chat

Run them in this order, each in a new chat. After each one, compare the Simulator with the pictures it names and tell Cursor what's off before moving on.

**Prompt 2: Workouts tab**

> Build the **Workouts** tab as described in `docs/SCREENS.md` section 2, matching `docs/screens/20-workouts-today.png` and `21-workouts-past-day.png`. Include the week strip, the day cards in all their states (today, completed, planned, open day, past rest day, logged activity), the activity chips with "Other", and the Fuel & recovery card. Swiping the cards or tapping the arrows changes day, and the cards slide in that direction. Use only engine functions for the data; take every word from `docs/COPY.md` through `copy.ts`. When done, list anything you couldn't match and any words marked TODO copy.

**Prompt 3: the workout (lift day) and rest timer**

> Build the **workout screen** from `docs/SCREENS.md` section 3, matching `docs/screens/23-workout-lift-day.png`, `24-workout-rest-timer.png` and `22-workout-completed.png`. It opens from a Workouts day card; a completed card expands into it. Include the "How do you feel today?" slider (labels Thriving / Normal / Rough, stored as Good / Normal / Rough), the exercise cards with set rows and ticks, "+ Set", the exercise picker, the cardio finisher and the "Day done" summary. Ticking a set starts the rest bar: the left and right halves are full-height tap zones for −15s and +15s, plus Skip; schedule a local notification with expo-notifications so it chimes with the phone locked, and cancel it on Skip. Every rule (sets, weights, rest times, progression) comes from the engine; don't recalculate anything in the screen. Same copy rules and report as before.

**Prompt 4: activities**

> Build **activity logging** from `docs/SCREENS.md` sections 2 and 4: tapping an activity chip logs it for the selected day; tapping a logged activity card opens it to edit minutes or delete; "Other" lists every activity not already on. Use the engine's activity functions. Pink theme as in `design.mdc`. Same copy rules and report as before.

**Prompt 5: Plan tab**

> Build the **Plan** tab from `docs/SCREENS.md` section 5, matching `docs/screens/30-plan-week.png`, `31-plan-week-checkin.png` and `32-plan-season.png`. The header title is the week's date range in Ranchers (or "SEASON") with a Week / Season switch; switching slides. Week view: the weekly check-in until it's saved, then the one-line summary with a pencil at the bottom; this week's plan rows with their status icons (tapping opens the workout); usual lift days and usual activity days toggles; Fuel & recovery with "How this is calculated"; This week's changes and Watch with (i) popovers. Season view: the "Your plan" sentence, the season switches, Goal / Pace / Lifting focus as pill selects with "Goal definitions". Same copy rules and report as before.

**Prompt 6: You tab**

> Build the **You** tab from `docs/SCREENS.md` section 7, matching `docs/screens/50-you.png` and `51-you-edit-profile.png`. Profile header with initial, name, "Member since", a pill per sport and activity, and Lifts / Activities / Weeks active tiles. Profile grid with labels on top and big values below, and an Edit profile button that opens the full form; Save changes stays disabled until something changes and sits above the tab bar. Training preferences with the Experience slider (Beginner, Some Experience, Advanced), Session length stepper and switches. App settings as two-way switches. The FAQ as expandable rows. Leave Your data / account as a placeholder section for now. Same copy rules and report as before.

**Prompt 7: History tab**

> Build the **History** tab from `docs/SCREENS.md` section 6, matching `docs/screens/40-history-calendar.png`, `41-history-weeks.png` and `42-history-lifts.png`. A Calendar / Weeks / Lifts switch that slides between views. Calendar: month grid with days filled green (lift), pink (activity) or split, tap a day for its details, and the Week mix chart. Weeks: past week cards and the empty state. Lifts: main lifts with their top-set trend lines. Same copy rules and report as before.

**Prompt 8: Onboarding**

> Build **onboarding** from `docs/SCREENS.md` section 1, matching every picture from `docs/screens/01-onboarding-welcome.png` to `10-onboarding-7-first-workout.png`. It shows once on first launch, before the tabs, and "Replay tour" on You opens it again. Include the Plan your week cards sliding in from the right one after another, the level demo slider that steps on its own, the seven setup steps with the live "Your plan so far" card, and visible borders on the number inputs. Finishing writes every answer into settings and replaces the activity list with exactly what was picked (don't merge with old activities). Same copy rules and report as before.

**After all eight:** ask Cursor to "compare every screen against its picture in `docs/screens/` and list differences," then fix them one chat at a time.

### Later: import, then backend

> Build the one-time "Import a Lift Board backup" screen from `docs/SCREENS.md` section 8 and `docs/BACKEND-SUPABASE.md`. Add a test using a sample backup file that checks the Lifts, Activities and Weeks active counts after import.

Only after you've used the app yourself for a week:

> Set up Supabase following `docs/BACKEND-SUPABASE.md`: migrations, row-level security, email code sign-in, the sync outbox and the two Edge Functions. Walk me through creating the Supabase project and where to paste each key.

## When something goes wrong

- Paste the full red error text into the chat and say what you were doing.
- If it keeps going in circles, start a new chat, attach the relevant picture and file, and describe the goal again in two sentences.
- If the engine tests fail, stop and tell Cursor: "Engine tests are failing; fix only that, don't change any rules."
- If you want to go back, the Source Control panel shows your saved commits; ask Cursor to "restore the project to my last commit."
