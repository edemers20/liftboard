# Start here: building Lift Board in Cursor

Everything Cursor needs is already in this repo:

- `.cursor/rules/` — four rules files Cursor applies to every request (product, engine, design, copy)
- `docs/SCREENS.md` — every screen, its states and navigation
- `docs/screens/` — a picture of each screen from the current app
- `docs/COPY.md` — every word in the app
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

### Prompt 2 onward: one screen at a time

Use this shape and change the screen name and pictures each time. Order: Workouts → Workout (lift day + rest timer) → Plan → You → History → Onboarding.

> Build the **Workouts** tab as described in `docs/SCREENS.md` section 2, matching `docs/screens/20-workouts-today.png` and `21-workouts-past-day.png`. Use only engine functions for the data; take every word from `docs/COPY.md` through `copy.ts`. Include the swipe and slide between days. When done, list anything you couldn't match and any words marked TODO copy.

### Later: import, then backend

> Build the one-time "Import a Lift Board backup" screen from `docs/SCREENS.md` section 8 and `docs/BACKEND-SUPABASE.md`. Add a test using a sample backup file that checks the Lifts, Activities and Weeks active counts after import.

Only after you've used the app yourself for a week:

> Set up Supabase following `docs/BACKEND-SUPABASE.md`: migrations, row-level security, email code sign-in, the sync outbox and the two Edge Functions. Walk me through creating the Supabase project and where to paste each key.

## When something goes wrong

- Paste the full red error text into the chat and say what you were doing.
- If it keeps going in circles, start a new chat, attach the relevant picture and file, and describe the goal again in two sentences.
- If the engine tests fail, stop and tell Cursor: "Engine tests are failing; fix only that, don't change any rules."
- If you want to go back, the Source Control panel shows your saved commits; ask Cursor to "restore the project to my last commit."
