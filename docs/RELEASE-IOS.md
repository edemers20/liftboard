# Releasing the iPhone app (EAS Build, TestFlight)

How Lift Board gets from this repo to TestFlight. Commands run in `apps/mobile`. Steps marked **Emma** need her Apple or Expo account; everything else is already in the repo.

**Secrets never go in chat, in git or in `app.json`.** They live in EAS environment variables or in EAS credentials, and Emma types them in herself.

## What's set up in the repo

| Thing | Where | Value |
| --- | --- | --- |
| App name | `app.json` `expo.name` | Lift Board |
| Bundle id | `app.json` `expo.ios.bundleIdentifier` | `app.liftboard` |
| Live Activity extension | `expo-widgets` plugin in `app.json` | `app.liftboard.widgets` |
| App Group (app and extension share it) | `expo-widgets` plugin | `group.app.liftboard` |
| Version people see | `app.json` `expo.version` | `1.0.0`. Raise it by hand for a new App Store version. |
| Build number | EAS (`"appVersionSource": "remote"` in `eas.json`) | Goes up by itself on every production build. Not in `app.json`. |
| Export compliance | `app.json` `ios.config.usesNonExemptEncryption: false` | The app only uses HTTPS, so App Store Connect stops asking on every build. |
| Privacy manifest | `app.json` `ios.privacyManifests` | No tracking; crash data, not linked; the standard required-reason API entries React Native needs. |
| Build profiles | `eas.json` | `development` (dev client, installs on registered phones), `preview` (internal), `production` (TestFlight and App Store). |
| Crash reports | `src/crash/report.ts`, `src/crash/scrub.ts` | Off until `EXPO_PUBLIC_SENTRY_DSN` is set. See below. |
| Privacy policy | `public/privacy.html` | Published with the web app at `https://edemers20.github.io/liftboard/privacy.html` once it's on `main`. Settings → Your data → Privacy policy opens it. |

## One-time setup (Emma)

1. **Expo account and CLI.** `npm install -g eas-cli`, then `eas login`.
2. **Link the project.** In `apps/mobile`, run `eas init`. It writes `extra.eas.projectId` (and `owner`) into `app.json`; commit that change.
3. **Apple sign-in for EAS.** The first `eas build --platform ios` asks to sign in to the Apple Developer account. Let EAS create and manage the certificate and provisioning profiles, and let it turn on the App Groups capability for `app.liftboard` and `app.liftboard.widgets`. Apple may ask for a 2-factor code; type it into the terminal, never into chat.
4. **App Store Connect app record.** App Store Connect → Apps → New App: platform iOS, name Lift Board, bundle id `app.liftboard`, SKU `liftboard`. Primary category Health & Fitness. Price Free.
5. **Submit key.** The first `eas submit --platform ios` offers to create an App Store Connect API key and store it on EAS. Say yes. The key stays on EAS; nothing goes in the repo.
6. **Crash reports (optional but recommended before friends test).**
   - Create a free Sentry account and a React Native project called `liftboard`.
   - Turn off "Store IP addresses" and data scraping that isn't needed (Project Settings → Security & Privacy: tick "Prevent storing of IP addresses", "Data scrubber" on, "Use default scrubbers" on).
   - Add the values as EAS environment variables (expo.dev → the project → Environment variables, or the commands below). Paste them there yourself:

     ```bash
     eas env:create --environment production --environment preview --name EXPO_PUBLIC_SENTRY_DSN --visibility plaintext
     eas env:create --environment production --environment preview --name SENTRY_ORG --visibility plaintext
     eas env:create --environment production --environment preview --name SENTRY_PROJECT --visibility plaintext
     eas env:create --environment production --environment preview --name SENTRY_AUTH_TOKEN --visibility secret
     ```

     Each command asks for the value. The DSN is safe in the app (it only allows sending reports). The auth token is a real secret: it uploads source maps so stack traces are readable, and it's never sent to the phone.
   - Without these, builds still work (`SENTRY_ALLOW_FAILURE` is on) and no crash reports are sent.

## Every TestFlight build

```bash
cd apps/mobile
eas build --platform ios --profile production
eas submit --platform ios --latest
```

Then in App Store Connect → TestFlight, add the build to the internal testing group (Emma) or an external group (the 3 to 5 friends). External testers need a one-time Beta App Review; fill in Test Information (what to test, a contact email) first.

For a development build on Emma's own phone (Live Activity testing, A-list checks): register the phone with `eas device:create`, then `eas build --platform ios --profile development`.

## App Store privacy label (App Privacy in App Store Connect)

Answer from what the app actually does today (on-device only, no sign-in yet):

- **Do you or your third-party partners collect data from this app?** Yes, only because of crash reports. If Sentry isn't set up, the answer is No.
- **Data type: Diagnostics → Crash Data.**
  - Used for: App Functionality.
  - Linked to the user's identity: **No**.
  - Used for tracking: **No**.
- **Everything else: not collected.** Health & Fitness, body measurements, cycle notes, workouts, contact info, identifiers, usage data and location stay on the phone and are never sent, so Apple doesn't count them as collected.
- **Tracking:** none. No App Tracking Transparency prompt is needed.

**Update the label (and `public/privacy.html`) before B5 ships.** Email sign-in and sync will add Contact Info → Email Address and Health & Fitness (linked to the user, App Functionality, not tracking).

## What crash reports can contain

`src/crash/scrub.ts` runs on every report before it leaves the phone and keeps only an allowlist: the error type, the error message with numbers and quoted text removed, stack frames (file, function, line), the app version and build, the iOS version and the iPhone model. Breadcrumbs, screen and route names, taps, network calls, logs, screenshots, the view tree, the user, tags and extra data are all dropped, and the Sentry integrations that gather them are switched off in `src/crash/report.ts`. `src/crash-scrub.test.ts` checks that weights, notes, emails and routes don't survive. Reports are never sent from development builds or the web build.

## Before the first external TestFlight

- [ ] Emma approves the privacy policy wording and fills in the contact email (`public/privacy.html`, marked TODO copy).
- [ ] Merge to `main` so GitHub Pages publishes the policy; paste its URL into App Store Connect → App Privacy → Privacy Policy URL.
- [ ] Fill in the App Privacy answers above.
- [ ] Settings shows "not medical advice" (it's at the bottom of Settings and on You).
