export const theme = {
  text: "#edeae8",
  muted: "#a8a09c",
  fuel: "#fea06a",
  /** Personal records: the week card's PRs tile, on screen and in the shared image. */
  record: "#b79cf0",
  /** Dark text and marks on a filled accent (week card tiles, milestones). */
  ink: "#2a1a12",
  green: {
    background: "#131615",
    surface: "#1d2220",
    accent: "#6fd0b4",
    accentFill: "#237a64",
    onAccent: "#ffffff",
  },
  orange: {
    background: "#181513",
    surface: "#24201d",
    accent: "#e9b69b",
    selectedFill: "#9d5324",
  },
  pink: {
    background: "#181416",
    surface: "#241f21",
    card: "#2a1f25",
    reminder: "#241d21",
    input: "#1c1519",
    accent: "#fc96bf",
    selectedFill: "#9c4a6d",
    onAccent: "#2a1520",
    tint: "rgba(252, 150, 191, 0.18)",
    line: "#5a3a48",
    /** Black at 30% over the pink surface. */
    secondary: "#191617",
  },
  /** Personal records: a deep purple card, no outline (`record` is the accent). */
  purple: {
    card: "#3a2f55",
    muted: "rgba(237, 234, 232, 0.65)",
    tint: "rgba(183, 156, 240, 0.14)",
  },
  /** Milestone cards (Emma's kind pairs): 135° gradients, dark text. */
  milestone: {
    lifts: ["#6fd0b4", "#c8e86a"],
    hours: ["#fea06a", "#f5d06a"],
    streak: ["#fc96bf", "#fea06a"],
    firstPr: ["#b79cf0", "#fc96bf"],
  } as const satisfies Record<string, readonly [string, string]>,
  banner: "#3a3018",
  radii: {
    small: 8,
    tile: 12,
    card: 16,
    pill: 999,
  },
  fonts: {
    display: "Ranchers_400Regular",
    body: "DMSans_400Regular",
    bodyMedium: "DMSans_500Medium",
    bodySemi: "DMSans_600SemiBold",
    bodyBold: "DMSans_700Bold",
    mono: "DMMono_400Regular",
    monoMedium: "DMMono_500Medium",
  },
} as const;
