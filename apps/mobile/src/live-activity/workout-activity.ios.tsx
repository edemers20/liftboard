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
 * Lock Screen and Dynamic Island layout. Widget runtime only: locals inside this function.
 *
 * Lock Screen: clear tint + lime wash. Never `glassEffect` (blanks the banner).
 *
 * Dynamic Island compact/minimal match the Expo docs shape: plain `Text` nodes, no `frame` /
 * `fixedSize` / `lineLimit` / `timerInterval` (those have left the Island empty while the
 * Lock Screen banner still painted). Trailing uses a short static label; the Lock Screen
 * keeps the live system timer.
 */
function WorkoutActivityLayout(props: WorkoutActivityProps, environment: LiveActivityEnvironment) {
  "widget";
  const limeA = "#6fd0b4";
  const limeB = "#c8e86a";
  const limeSoft = "#9fcfc1";
  const fillDone = "#237a64";
  const warn = "#e07a6a";
  const text = environment.isLuminanceReduced ? "#ffffff" : "#edeae8";
  const muted = environment.isLuminanceReduced ? "rgba(255,255,255,0.78)" : "rgba(237,234,232,0.78)";
  const track = "rgba(255,255,255,0.22)";
  const white = "#ffffff";
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
  const resting = !props.finished && props.restEnd > 0 && !environment.isStale;
  const restColor = props.restUrgent ? warn : limeSoft;
  const restRange = { lower: new Date(props.restStart || props.restEnd), upper: new Date(props.restEnd) };
  const workoutStart = props.workoutStart || Date.now();
  const elapsedRange = {
    lower: new Date(workoutStart),
    upper: new Date(workoutStart + maxLiveMs),
  };

  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const clockLabel = (total: number) => {
    const s = Math.max(0, Math.floor(total));
    return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
  };
  /** Snapshot for Island only; Lock Screen uses system timerInterval. */
  const nowMs = Date.now();
  const islandTrail = props.finished
    ? props.doneLabel
    : resting
      ? clockLabel((props.restEnd - nowMs) / 1000)
      : props.weightCompact || clockLabel((nowMs - workoutStart) / 1000);
  const islandLead = props.exercise || props.title || "Workout";
  const islandLeadColor = white;
  const islandTrailColor = props.finished ? limeSoft : resting ? restColor : limeSoft;

  const bannerClock = (size: number) =>
    props.finished ? (
      <Text
        modifiers={[
          font({ size, weight: "semibold" }),
          foregroundStyle(limeSoft),
          multilineTextAlignment("trailing"),
          lineLimit(1),
          fixedSize({ horizontal: true, vertical: true }),
        ]}
      >
        {props.doneLabel}
      </Text>
    ) : resting ? (
      <Text
        timerInterval={restRange}
        countsDown
        modifiers={[
          font({ size, weight: "medium", design: "monospaced" }),
          monospacedDigit(),
          foregroundStyle(restColor),
          multilineTextAlignment("trailing"),
          lineLimit(1),
          minimumScaleFactor(0.75),
          fixedSize({ horizontal: true, vertical: true }),
        ]}
      />
    ) : (
      <Text
        timerInterval={elapsedRange}
        countsDown={false}
        modifiers={[
          font({ size, weight: "medium", design: "monospaced" }),
          monospacedDigit(),
          foregroundStyle(text),
          multilineTextAlignment("trailing"),
          lineLimit(1),
          minimumScaleFactor(0.75),
          fixedSize({ horizontal: true, vertical: true }),
        ]}
      />
    );

  const timeLabel =
    props.finished ? null : resting ? (
      <Text
        modifiers={[
          font({ size: 11, weight: "medium" }),
          foregroundStyle(muted),
          multilineTextAlignment("trailing"),
          lineLimit(1),
        ]}
      >
        {props.restLabel}
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
        {props.elapsedLabel}
      </Text>
    );

  const timeBlock = (
    <VStack
      alignment="trailing"
      spacing={2}
      modifiers={[layoutPriority(1), frame({ minWidth: 52, alignment: "trailing" }), fixedSize({ horizontal: true, vertical: true })]}
    >
      {bannerClock(24)}
      {timeLabel}
    </VStack>
  );

  const setBars = () =>
    props.setsTotal > 0 ? (
      <HStack spacing={4} modifiers={[padding({ top: 12 })]}>
        {Array.from({ length: props.setsTotal }, (_, index) => {
          const done = index < props.setsDone;
          const current = !done && index === props.setNow && !props.finished;
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
      <HStack alignment="top" spacing={10}>
        <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(1), frame({ maxWidth: 9999, alignment: "leading" })]}>
          <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{props.title}</Text>
          {props.exercise ? (
            <Text modifiers={[font({ size: 16, weight: "semibold" }), foregroundStyle(text), lineLimit(2), minimumScaleFactor(0.85)]}>
              {props.exercise}
            </Text>
          ) : null}
          {props.setLine ? (
            <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{props.setLine}</Text>
          ) : null}
        </VStack>
        <Spacer />
        {timeBlock}
      </HStack>
      {setBars()}
    </VStack>
  );

  return {
    banner: bannerBody,
    // Docs-shaped Island: plain Text only. No frame / timerInterval / fixedSize.
    compactLeading: (
      <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(islandLeadColor)]}>{islandLead}</Text>
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
        {props.setLine ? (
          <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle(muted)]}>{props.setLine}</Text>
        ) : null}
        {setBars()}
      </VStack>
    ),
  };
}

export const WorkoutActivity: LiveActivityFactory<WorkoutActivityProps> | null = createLiveActivity<WorkoutActivityProps>(
  "WorkoutActivity",
  WorkoutActivityLayout,
);
