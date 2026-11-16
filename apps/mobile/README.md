# Lift Board mobile

Expo, Expo Router and TypeScript. iOS first. The plan is computed on the phone by `packages/engine`.

## Run in browser

For checking layout and flows on a desktop without a phone. It is a preview, not a supported platform.

```bash
cd apps/mobile
npm install
npx expo start --web
```

Open the address Expo prints (usually http://localhost:8081). A narrow window, around 430 px wide, looks closest to the phone.

Data is saved in the browser's local storage, so it stays across reloads. Clear site data to start onboarding again.

### What does not work on web

- Liquid Glass. Controls use their solid fallback.
- iOS native tabs, the card zoom into a workout and form sheets. The JS tab bar and the shared move are used instead.
- Swipe to delete has not been checked with a mouse. Use a phone for it.
- Haptics are off.
- Save to Photos and Share do nothing. The card is not captured.
- Rest alerts do not notify. The in-app timer and the chime still run.
- Live Activity and the iOS tab bar workout accessory.
- Dev builds can show a red React warning toast ("Cannot update a component while rendering") when a workout starts. Dismiss it; it does not stop the app.

Use a phone or the iOS simulator (`npx expo run:ios`) to check anything in the list above.
