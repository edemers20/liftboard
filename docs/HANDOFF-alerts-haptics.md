# Rest timer alerts, Dynamic Island, haptics and transitions

Build in the native app (`apps/mobile`), following `.cursor/rules/`. Three parts, each in its own chat, in this order. Commit after each.

Check every library's docs for the Expo SDK version installed in this project before writing code; APIs change between SDKs.

---

## Part 1: Rest timer alerts and sounds

The rest timer already exists on the workout screen (see `docs/SCREENS.md` section 3). This part makes it reliable when the phone is locked or the app is in the background, without interrupting music.

**Sound in the app (expo-audio)**
- A short chime when rest reaches zero while the app is open.
- Set the audio mode so the chime **mixes with or briefly ducks the person's music and never pauses it**, and plays even with the ring/silent switch on silent if the platform allows it while mixing. Never use a mode that interrupts other audio.
- Respect the "Rest timer sound" setting on You; "Play test sound" plays the same chime.

**Local notification (expo-notifications), no server**
- When rest starts, schedule one local notification for the moment rest ends: title "Rest's up", body "Set {n} of {total} · {exercise}".
- On **−15s / +15s**, cancel and reschedule it for the new end time. On **Skip**, or when the next set is ticked, cancel it.
- If the app is open in the foreground when it fires, don't show the banner; play the in-app chime and haptic instead (Part 3).
- Use a bundled chime file for the notification sound (registered through the expo-notifications config plugin `sounds` option).
- Ask for notification permission the first time a rest timer starts, not at launch. If it's denied, everything still works in the app with no warning screens.

**Done when:** rest ends with the phone locked and music playing → the notification arrives with the chime and the music keeps playing.

---

## Part 2: Live Activity (Lock Screen + Dynamic Island)

A workout in progress shows on the Lock Screen and in the Dynamic Island, like a timer or a delivery.

**Library:** Expo's widgets library (`expo-widgets`) supports Live Activities on iOS and needs a development build (not Expo Go). If it doesn't fit, use Software Mansion's `expo-live-activity`. **No push notifications or server are needed**: the app starts and updates the activity itself, and the countdown ticks on its own.

**What it shows**
- **Lock Screen / expanded:** workout title (e.g. "Lower · Hinge & Glute"), current exercise and "Set 3 of 4", and either the rest countdown ("Rest 1:42") or "Go" when rest is over. A thin progress bar of sets done out of total.
- **Dynamic Island, compact:** a small dumbbell icon on the left; the rest countdown (or "Go") on the right, in DM Mono if custom fonts are supported, else the system monospaced digits.
- **Dynamic Island, minimal:** the countdown only.
- Colours: dark background, green accent (#6fd0b4), orange (#fea06a) for "Go".

**When it changes**
- **Start** when the workout starts (Start workout).
- **Update** when a set is ticked (new set, new rest end time), on ±15s, on Skip, and when moving to the next exercise.
- **End** at Day done, showing "Day done ✓" briefly, then dismiss. Also end it if the workout is reset or abandoned, and never leave one running over 8 hours.
- Tapping it opens the app on the workout screen.

**Done when:** start a workout, lock the phone, tick a set from the app, and watch the countdown run on the Lock Screen and in the Dynamic Island.

---

## Part 3: Haptics and transitions

Use `expo-haptics` and Reanimated. Put every haptic behind one small helper (`haptic.tap()`, `haptic.success()`…) so they're consistent and can be turned off. Respect Reduce Motion for animations (fade instead of slide or scale). Never fire a haptic on scroll or on every keystroke.

**Haptic map**

| Moment | Haptic |
| --- | --- |
| Tick a set | Light impact |
| Rest timer reaches zero (app open) | Success notification |
| −15s / +15s, Skip | Selection |
| Pill selects, switches, the experience slider stops, day strip taps | Selection |
| Swap workout chosen, Move to today | Medium impact |
| A lift goes up next time (shown in Day done) | Success notification |
| Day done | Success notification, then a short double light tap as the summary appears |
| Week finished (button or automatic) and the weekly report opens | Heavy impact, then success |
| A change that updates the plan and shows the bottom toast (e.g. "Fuel today +120", "Pull moved to today") | Light impact when the toast appears |
| Destructive confirm (delete activity, reset) | Warning notification |
| Onboarding: each setup step's answer picked | Selection |
| Onboarding: the first week loading on the final step | See the sequence below |

**Transitions**
- **Onboarding, "You're set" (first week loads):** the first workout card scales in from 96% and fades in; then each remaining day of the week drops in from 12px above, one after another, 80ms apart. Fire a **light impact for each day as it lands** and a **success notification when the last one lands**. Total under 1.2 seconds.
- **Day done:** the check mark draws, the title and stat tiles rise in, staggered 60ms (as the web app does). Haptics as in the table.
- **Week finished / weekly report:** the report slides up as a sheet; its numbers count up from 0 over 600ms.
- **Bottom toast:** slides up 16px and fades in; slides down and fades out after about 2.5 seconds; it can be swiped away.
- **Tabs, Plan Week/Season, History views, days on Workouts:** slide left or right in order (already in `design.mdc`).
- **Completed workout card → workout screen:** shared-element expand of the card into the page.
- **Swap sheet and other sheets:** slide up with the dimmed overlay fading in to 75% black.
- **Set ticked:** the tick fills with a quick scale bounce (1 → 1.15 → 1).

**Done when:** every row in the haptic map fires on a real iPhone (haptics don't work in the Simulator), and turning on Reduce Motion replaces the slides with fades.
