import { HStack, RoundedRectangle, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  activityBackgroundTint,
  background,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  multilineTextAlignment,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment, type LiveActivityFactory } from "expo-widgets";

import type { WorkoutActivityProps } from "./state";

/**
 * Lock Screen + Dynamic Island. Widget runtime only: every value used here is local
 * (module-scope constants blank / throw in the extension, as with the old LIME_A bug).
 *
 * Visibility note (9903): translucent lime wash + activityBackgroundTint("clear") painted a
 * hollow Lock Screen / expanded chrome after JS succeeded. Force opaque bg + white text until
 * a proven glass path lands. Compact leading gets a short name + aggressive scale; trailing
 * stays a short timer/weight only.
 */
function WorkoutActivityLayout(props: WorkoutActivityProps, environment: LiveActivityEnvironment) {
  "widget";
  const p = props || ({} as WorkoutActivityProps);
  const env = environment || ({} as LiveActivityEnvironment);

  const limeA = "#6fd0b4";
  const limeB = "#c8e86a";
  const limeSoft = "#9fcfc1";
  const fillDone = "#237a64";
  const warn = "#e07a6a";
  /** Forced-visible palette: opaque green plate + white type (diag for invisible paint). */
  const plate = "#1a3d32";
  const text = "#ffffff";
  const muted = "rgba(255,255,255,0.85)";
  const track = "rgba(255,255,255,0.28)";
  const white = "#ffffff";
  const lime = limeA;
  const limeBarGrad = {
    type: "linearGradient" as const,
    colors: [limeA, limeB],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 0 },
  };

  const maxLiveMs = 8 * 3600e3;
  const finished = !!p.finished;
  const restEnd = typeof p.restEnd === "number" ? p.restEnd : Number(p.restEnd) || 0;
  const restStart = typeof p.restStart === "number" ? p.restStart : Number(p.restStart) || 0;
  const workoutStartRaw = typeof p.workoutStart === "number" ? p.workoutStart : Number(p.workoutStart) || 0;
  const workoutStart = workoutStartRaw || Date.now();
  const restUrgent = !!p.restUrgent;
  const setsDone = Math.max(0, Number(p.setsDone) || 0);
  const setsTotal = Math.max(0, Math.min(12, Number(p.setsTotal) || 0));
  const setNow = Number(p.setNow);
  const title = p.title || "Workout";
  const exercise = p.exercise || "";
  const setLine = p.setLine || "";
  const weightCompact = p.weightCompact || "";
  const restLabel = p.restLabel || "Rest";
  const elapsedLabel = p.elapsedLabel || "Elapsed";
  const doneLabel = p.doneLabel || "Done";

  const restColor = restUrgent ? warn : lime;
  const resting = !finished && restEnd > 0 && !env.isStale;
  const restRange = { lower: new Date(restStart || restEnd), upper: new Date(restEnd) };
  const elapsedRange = {
    lower: new Date(workoutStart),
    upper: new Date(workoutStart + maxLiveMs),
  };

  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const clockLabel = (total: number) => {
    const s = Math.max(0, Math.floor(total));
    return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
  };
  /** Compact Island leading is ~half the pill; keep names short enough to scale. */
  const shortIslandName = (name: string) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return "Lift";
    if (trimmed.length <= 14) return trimmed;
    const words = trimmed.split(/\s+/);
    if (words.length >= 2) {
      const two = `${words[0]} ${words[1]}`;
      if (two.length <= 16) return two;
      // "Single-Leg Romanian Deadlift" → "Single-Leg…"
      if (words[0].length <= 12) return `${words[0]}…`;
    }
    return `${trimmed.slice(0, 12)}…`;
  };
  const nowMs = Date.now();
  const islandLeadFull = exercise || title;
  const islandLead = shortIslandName(islandLeadFull);
  // Trailing: timer while resting, weight (or elapsed) while lifting — never a long string.
  const islandTrail = finished
    ? doneLabel
    : resting
      ? clockLabel((restEnd - nowMs) / 1000)
      : weightCompact || clockLabel((nowMs - workoutStart) / 1000);
  const islandTrailColor = finished ? limeSoft : resting ? (restUrgent ? warn : limeSoft) : limeSoft;

  const clockText = (size: number, color: string, opts?: { width?: number; banner?: boolean }) => {
    const base = [
      font({ size, weight: "medium", design: "monospaced" }),
      monospacedDigit(),
      foregroundStyle(color),
      multilineTextAlignment("trailing"),
      lineLimit(1),
      minimumScaleFactor(0.75),
    ];
    if (opts && opts.banner) {
      return [...base, fixedSize({ horizontal: true, vertical: true })];
    }
    if (opts && opts.width) {
      return [...base, frame({ width: opts.width, alignment: "trailing" })];
    }
    return base;
  };

  const bigClock = (size: number, opts?: { width?: number; banner?: boolean }) =>
    finished ? (
      <Text modifiers={[font({ size, weight: "semibold" }), foregroundStyle(lime), multilineTextAlignment("trailing"), lineLimit(1)]}>
        {doneLabel}
      </Text>
    ) : resting ? (
      <Text timerInterval={restRange} countsDown modifiers={clockText(size, restColor, opts)} />
    ) : (
      <Text timerInterval={elapsedRange} countsDown={false} modifiers={clockText(size, text, opts)} />
    );

  const timeLabel = finished ? null : resting ? (
    <Text
      modifiers={[
        font({ size: 11, weight: "medium" }),
        foregroundStyle(muted),
        multilineTextAlignment("trailing"),
        lineLimit(1),
      ]}
    >
      {restLabel}
    </Text>
  ) : (
    <Text
      modifiers={[
        font({ size: 11, weight: "medium" }),
        foregroundStyle(muted),
        multilineTextAlignment("trailing"),
        lineLimit(1),
      ]}
    >
      {elapsedLabel}
    </Text>
  );

  const timeBlock = (
    <VStack
      alignment="trailing"
      spacing={2}
      modifiers={[layoutPriority(1), frame({ minWidth: 56, alignment: "trailing" }), fixedSize({ horizontal: true, vertical: true })]}
    >
      {bigClock(24, { banner: true })}
      {timeLabel}
    </VStack>
  );

  const setBars =
    setsTotal > 0 ? (
      <HStack spacing={4} modifiers={[padding({ top: 12 })]}>
        {Array.from({ length: setsTotal }, (_, index) => {
          const done = index < setsDone;
          const current = !done && index === setNow && !finished;
          const fill = done ? fillDone : current ? limeBarGrad : track;
          return (
            <RoundedRectangle
              cornerRadius={2}
              modifiers={[
                frame({ minWidth: 0, maxWidth: 9999, minHeight: 5, maxHeight: 5 }),
                background(fill),
              ]}
            />
          );
        })}
      </HStack>
    ) : null;

  // Opaque plate (not clear / not translucent wash) so Lock Screen cannot paint hollow chrome.
  const bannerBody = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[padding({ all: 14 }), activityBackgroundTint(plate), background(plate)]}
    >
      <HStack alignment="top" spacing={12}>
        <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(0), frame({ maxWidth: 9999, alignment: "leading" })]}>
          <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{title}</Text>
          {exercise ? (
            <Text modifiers={[font({ size: 16, weight: "semibold" }), foregroundStyle(text), lineLimit(2)]}>{exercise}</Text>
          ) : null}
          {setLine ? (
            <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{setLine}</Text>
          ) : null}
        </VStack>
        <Spacer />
        {timeBlock}
      </HStack>
      {setBars}
    </VStack>
  );

  const compactLeadMods = [
    font({ size: 12, weight: "semibold" }),
    foregroundStyle(white),
    lineLimit(1),
    minimumScaleFactor(0.55),
  ];
  const compactTrailMods = [
    font({ size: 12, weight: "medium", design: "monospaced" }),
    monospacedDigit(),
    foregroundStyle(islandTrailColor),
    lineLimit(1),
    minimumScaleFactor(0.7),
    fixedSize({ horizontal: true, vertical: true }),
  ];

  return {
    banner: bannerBody,
    compactLeading: <Text modifiers={compactLeadMods}>{islandLead}</Text>,
    compactTrailing: <Text modifiers={compactTrailMods}>{islandTrail}</Text>,
    minimal: (
      <Text
        modifiers={[
          font({ size: 11, weight: "medium", design: "monospaced" }),
          monospacedDigit(),
          foregroundStyle(islandTrailColor),
          lineLimit(1),
          minimumScaleFactor(0.6),
        ]}
      >
        {islandTrail}
      </Text>
    ),
    expandedLeading: (
      <Text
        modifiers={[
          font({ size: 14, weight: "semibold" }),
          foregroundStyle(white),
          padding({ leading: 4 }),
          lineLimit(2),
          minimumScaleFactor(0.7),
        ]}
      >
        {islandLeadFull}
      </Text>
    ),
    expandedTrailing: (
      <Text
        modifiers={[
          font({ size: 16, weight: "medium", design: "monospaced" }),
          monospacedDigit(),
          foregroundStyle(islandTrailColor),
          lineLimit(1),
        ]}
      >
        {islandTrail}
      </Text>
    ),
    // Was missing → EmptyView center made the expanded Island feel hollow.
    expandedCenter: (
      <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>
        {setLine || title}
      </Text>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ horizontal: 4 }), background(plate)]}>
        {setLine ? (
          <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle(text)]}>{setLine}</Text>
        ) : (
          <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle(text)]}>{islandLeadFull}</Text>
        )}
        {setBars}
      </VStack>
    ),
  };
}

export const WorkoutActivity: LiveActivityFactory<WorkoutActivityProps> | null = createLiveActivity<WorkoutActivityProps>(
  "WorkoutActivity",
  WorkoutActivityLayout,
);
