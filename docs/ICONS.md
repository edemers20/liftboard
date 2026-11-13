# Icons

Lift Board doesn't use an icon package. Its icons are a small custom set drawn on a 24 × 24 grid as outlines with round ends and corners. That's the same drawing style as **Lucide**, so Lucide is the package to use for anything new.

- **The set:** `assets/icons/*.svg` (16 files). A picture of all of them: `docs/screens/icons.png`.
- **Package for new icons:** `lucide-react-native` (needs `react-native-svg`, which Expo includes).

## Rules for Cursor

1. Turn every file in `assets/icons/` into a component in `apps/mobile/src/icons/` with `react-native-svg` (or `react-native-svg-transformer`). Each takes `size` and `color` and keeps the file's stroke width. Colour comes from `currentColor`, so pass the theme colour.
2. Use these components wherever the table below says. Don't replace them with Lucide lookalikes; the tab bar dumbbell in particular is ours.
3. For an icon that isn't in the set, use `lucide-react-native` with `strokeWidth={1.8}` in the tab bar and large cards and `strokeWidth={2}` inline (buttons, pills). Then add it to the table in this file.
4. No filled icons, emoji or other icon packages (no SF Symbols, Ionicons or Material).
5. Every icon-only button needs an accessibility label; icons next to a text label are hidden from screen readers.
6. Tap targets stay at least 44 × 44 even when the icon is 14.

## Outline icons (24 grid, `currentColor`)

| Name | Size used | Stroke | Where | Closest Lucide |
| --- | --- | --- | --- | --- |
| `tab-workouts` | 22 | 1.8 | Tab bar: Workouts; onboarding "What to lift today" card (green) | `dumbbell (different shape)` |
| `tab-plan` | 22 | 1.8 | Tab bar: Plan | `calendar` |
| `tab-history` | 22 | 1.8 | Tab bar: History | `chart-column` |
| `tab-you` | 22 | 1.8 | Tab bar: You | `user` |
| `swap` | 16 | 2 | Swap pill on the lift card (15) and Swap workout pill on the workout screen (16) | `arrow-right-left` |
| `share` | 16 | 2 | Share on Day done, Share workout, weekly report | `share` |
| `edit` | 18 | 1.9 | Edit check-in (Plan → Week) | `pencil` |
| `close` | 14 | 2 | Close on every sheet and dialog (white, 14, inside a 44 tap target) | `x` |
| `check` | 28 | 3 | Day done / Week done check mark (mint, inside a 56 circle; the stroke draws in) | `check` |
| `arrow-right` | 14 | 1.8 | Onboarding "Plan your week" example rows (Last → Today) | `arrow-right` |
| `check-circle` | 28 | 1.8 | Onboarding "Fits around everything else" card (pink) | `circle-check` |
| `fuel` | 28 | 1.8 | Onboarding "Fuel and recover" card (orange) | `droplet` |
| `info` | 16 | 1.6 | Tips and the (i) buttons on This week's changes and Watch | `info` |

## Status badges (20 grid, fixed colours)

Used as the status of each row in Plan → This week's plan.

| Name | Meaning |
| --- | --- |
| `status-done` | Done (grey disc, grey check) |
| `status-next` | Next up (green disc, dark chevron) |
| `status-open` | Still to do (empty ring) |

## Text symbols, not icons

These are typed characters in DM Sans or DM Mono, and stay as text in the native app:

- `‹` `›` back link ("‹ Workouts") and previous/next day arrows
- `✓` a ticked set and "✓ Day done"
- `↑` `↓` a weight going up or down next time (orange when up)
- `×` in weights ("155 × 8") and counts ("Pickleball ×2")
- `−` `+` steppers, "−15s / +15s" (a real minus sign, not a hyphen)
- `→` in "150 → 155"
