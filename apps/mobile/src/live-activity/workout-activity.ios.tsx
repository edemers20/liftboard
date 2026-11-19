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
 * Layout is stored in app-group UserDefaults and evaluated in JavaScriptCore. Missing
 * ContentState props produced: TypeError undefined is not an object (evaluating
 * 'props.restUrgent') → ExpoWidgets RedBox on the Lock Screen. Guard props/environment.
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
  const text = env.isLuminanceReduced ? "#ffffff" : "#edeae8";
  const muted = env.isLuminanceReduced ? "rgba(255,255,255,0.78)" : "rgba(237,234,232,0.78)";
  const track = "rgba(255,255,255,0.22)";
  const white = "#ffffff";
  const lime = limeA;
  const limeBarGrad = {
    type: "linearGradient" as const,
    colors: [limeA, limeB],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 0 },
  };
  const limeWash = {
    type: "linearGradient" as const,
    colors: ["rgba(111,208,180,0.50)", "rgba(200,232,106,0.38)"],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 },
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
  const nowMs = Date.now();
  const islandLead = exercise || title;
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

  const bannerBody = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[padding({ all: 14 }), activityBackgroundTint("clear"), background(limeWash)]}
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

  return {
    banner: bannerBody,
    compactLeading: (
      <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(white)]}>{islandLead}</Text>
    ),
    compactTrailing: (
      <Text modifiers={[font({ size: 13, weight: "medium", design: "monospaced" }), monospacedDigit(), foregroundStyle(islandTrailColor)]}>
        {islandTrail}
      </Text>
    ),
    minimal: (
      <Text modifiers={[font({ size: 12, weight: "medium", design: "monospaced" }), monospacedDigit(), foregroundStyle(islandTrailColor)]}>
        {islandTrail}
      </Text>
    ),
    expandedLeading: (
      <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(white), padding({ leading: 4 })]}>{islandLead}</Text>
    ),
    expandedTrailing: (
      <Text modifiers={[font({ size: 16, weight: "medium", design: "monospaced" }), monospacedDigit(), foregroundStyle(islandTrailColor)]}>
        {islandTrail}
      </Text>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ horizontal: 4 })]}>
        {setLine ? (
          <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle(muted)]}>{setLine}</Text>
        ) : null}
        {setBars}
      </VStack>
    ),
  };
}

export const WorkoutActivity: LiveActivityFactory<WorkoutActivityProps> | null = createLiveActivity<WorkoutActivityProps>(
  "WorkoutActivity",
  WorkoutActivityLayout,
);
