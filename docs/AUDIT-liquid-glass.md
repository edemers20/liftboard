# Liquid Glass audit (native app, iOS 26)

Where Lift Board can use iOS 26's Liquid Glass materials and the motion that comes with them, ranked by how much each is worth. Checked against the Expo SDK 58 docs (native tabs, glass effect, Expo Router v55 zoom transitions and toolbars) on Nov 13, 2026. Check the docs for the installed SDK before building; several of these APIs are marked unstable.

**The rule that decides most of this:** Liquid Glass is for the layer that floats above content (tab bar, toolbars, floating controls, sheets, menus), not for the content itself. Day cards, stat tiles, exercise cards and charts stay solid. Glass on content hurts legibility, especially on our dark warm backgrounds, and glass on glass looks muddy.

---

## Do these

### 1. A live workout above the tab bar (`NativeTabs.BottomAccessory`)
While a workout is in progress and you leave its screen, a glass pill floats above the tab bar, like the Music mini-player: "Lower (Hinge & Glute) · Rest 1:42" (or "Set 3 of 4" when not resting). Tapping it returns to the workout. When the tab bar minimizes it shrinks to the inline layout (`usePlacement()` returns `'inline'`): just the countdown.
- Why: today you lose sight of the rest timer as soon as you check Plan or log an activity mid-workout. This keeps it one tap away, and it pairs with the Lock Screen Live Activity.
- Ends when the workout ends ("Day done ✓" for a moment, then gone).

### 2. Card-to-workout zoom (`withAppleZoom` on `Link.Trigger`)
Opening a workout from a Workouts day card uses the system zoom transition: the card grows into the workout screen, and swiping down or back shrinks it into the card. This replaces the custom card-expand animation and answers the "should be more clear/sharp" note: it's the system's own timing, it can be interrupted mid-gesture, and it supports swipe-down to close.
- Watch for: Apple's forums report the source card occasionally disappearing after an interrupted zoom on iOS 26. Test fast back-and-forth; if it shows up, fall back to the custom transition in section 8.

### 3. Sheets as native form sheets
The swap sheet, the weight suggestion ("That looked easy"), activity details and the weekly report become native sheets (`presentation: 'formSheet'` with detents), not custom sheets with a dim overlay. On iOS 26 a partial-height sheet floats inset with a glass background and becomes opaque as it's dragged to full height. Dragging down closes it.
- Swap workout and the weight suggestion: one small detent fitted to their content.
- Weekly report: a large detent that can expand to full height.
- Tips stay as small popovers (section 8), not sheets.

### 4. The rest bar as floating glass controls (`GlassView` in a `GlassContainer`)
The rest bar becomes a glass capsule floating above the content: **−15s · Rest 1:42 / Skip · +15s**. Inside a `GlassContainer`, the −15s and +15s buttons start merged into the timer and separate out as it appears, then merge back when rest ends. Use `isInteractive` so the glass reacts to touch.
- At zero, tint the glass orange (#fea06a) and read "Go".
- Animate in and out with the `glassEffectStyle` config (`animate`, `animationDuration`), not by changing opacity; the docs say glass doesn't render properly below opacity 1.

### 5. Tab bar that gets out of the way (`minimizeBehavior: 'onScrollDown'`)
On History and You (long scrolling pages) the tab bar shrinks while scrolling down and returns on scroll up. Keep it `'never'` on Workouts, where the bar is used constantly. The workout screen hides the tab bar already.

### 6. Workout screen toolbar (`Stack.Toolbar`)
The workout screen's top controls (back, Swap workout, Share once done) become a native toolbar with glass buttons, and the title scrolls under it with the system's scroll edge effect. This replaces the hand-built header and gets the glass treatment for free.

---

## Worth trying

### 7. Primary actions as prominent glass buttons
"Start workout" on the Workouts card and "Log set" in the playlist view as a tinted (green) glass button floating at the bottom of the screen, instead of a flat fill inside the card. Try it on the playlist view first, where one big button is the whole screen's job.

### 8. Long-press menus on day cards
Long-pressing a lift card opens a native context menu: Swap, Move to today, Skip this week. Native menus get glass automatically, and Expo Router's link previews (`Link.Preview`, `Link.Menu`) can show a peek of the workout above the menu. Useful for people who know the app well; everything stays reachable by tap too.

### 9. A floating date line on Workouts
With the day carousel (section 6), the "‹ Friday, Nov 13 ›" line could be a small glass capsule pinned under the week strip while the day's content scrolls beneath it.

---

## Don't

- **No glass on content:** day cards, stat tiles, exercise cards, History charts, the profile grid. Keep them solid surfaces.
- **No glass on glass:** nothing glass inside a sheet that's already glass, and no glass pill on top of the bottom accessory.
- **Onboarding stays solid.** Full-screen steps with big type read better on solid backgrounds.
- **Don't fake it on older iOS.** Below iOS 26, `GlassView` falls back to a plain view: use our solid surface colour (#24201d), not a home-made blur.

## Accessibility and fallbacks
- Check `AccessibilityInfo.isReduceTransparencyEnabled()`. When on, every glass element uses the solid surface colour instead. `isLiquidGlassAvailable()` doesn't account for this setting.
- Call `isGlassEffectAPIAvailable()` before rendering `GlassView` or `GlassContainer` (some iOS 26 betas crash without it).
- Reduce Motion: no morphing between rest buttons; fades instead of the zoom transition.
- Text on glass needs enough contrast: test the rest timer and the bottom accessory over both a dark card and a bright green Start button.

## Build order
1. Native tab bar (already in section 8), then `minimizeBehavior` (item 5).
2. Zoom transition (item 2) and native sheets (item 3): they replace custom code, so they also make the app simpler.
3. Bottom accessory for a live workout (item 1).
4. Glass rest bar (item 4) and the workout toolbar (item 6).
5. Try items 7–9 and keep the ones that feel right on a real phone.

## Sources
- Expo native tabs (SDK 58): https://docs.expo.dev/versions/v58.0.0/sdk/router/native-tabs/
- Expo glass effect (SDK 58): https://docs.expo.dev/versions/v58.0.0/sdk/glass-effect/
- Expo Router v55 (zoom transitions, toolbars, bottom accessory): https://expo.dev/blog/expo-router-v55-more-native-navigation-more-powerful-web
- Zoom transition issues on iOS 26: https://developer.apple.com/forums/thread/796805
- Liquid Glass sheets: https://nilcoalescing.com/blog/PresentingLiquidGlassSheetsInSwiftUI
