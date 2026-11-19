import { HStack, RoundedRectangle, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  activityBackgroundTint,
  background,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment, type LiveActivityFactory } from "expo-widgets";

import type { WorkoutActivityProps } from "./state";

/**
 * Lock Screen and Dynamic Island layout. It runs in the widget extension's own runtime: everything it uses is
 * declared inside the function (no module-scope values). The countdown is a system timer, and the activity goes
 * stale at the rest end. The extension has no DM Mono, so digits use the system monospaced font.
 *
 * Lock Screen liquid glass: `activityBackgroundTint` with lime (not `glassEffect`, which blanks the banner).
 * Lime palette on bars, rest timer and accents must still read on top of that tint.
 */
function WorkoutActivityLayout(props: WorkoutActivityProps, environment: LiveActivityEnvironment) {
  "widget";
  const limeA = "#6fd0b4";
  const limeB = "#c8e86a";
  const fillDone = "#237a64";
  const warn = "#e07a6a";
  const text = environment.isLuminanceReduced ? "#ffffff" : "#edeae8";
  const muted = environment.isLuminanceReduced ? "rgba(255,255,255,0.78)" : "rgba(237,234,232,0.78)";
  const track = "rgba(255,255,255,0.28)";
  // Accents stay lime even when luminance is reduced so the Lock Screen does not go colorless.
  const lime = limeA;
  const limeGrad = {
    type: "linearGradient" as const,
    colors: [limeA, limeB],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 0 },
  };
  /** Match MAX_LIVE_MS in state.ts; inlined so the widget runtime does not close over imports. */
  const maxLiveMs = 8 * 3600e3;
  const restColor = props.restUrgent ? warn : lime;
  const resting = !props.finished && props.restEnd > 0 && !environment.isStale;
  const restRange = { lower: new Date(props.restStart || props.restEnd), upper: new Date(props.restEnd) };
  const workoutStart = props.workoutStart || Date.now();
  const elapsedRange = {
    lower: new Date(workoutStart),
    upper: new Date(workoutStart + maxLiveMs),
  };

  const bigClock = (size: number, width?: number) =>
    props.finished ? (
      <Text modifiers={[font({ size, weight: "semibold" }), foregroundStyle(lime)]}>{props.doneLabel}</Text>
    ) : resting ? (
      <Text
        timerInterval={restRange}
        countsDown
        modifiers={[
          font({ size, weight: "medium", design: "monospaced" }),
          monospacedDigit(),
          foregroundStyle(restColor),
          ...(width ? [frame({ width })] : []),
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
          ...(width ? [frame({ width })] : []),
        ]}
      />
    );

  const setBars =
    props.setsTotal > 0 ? (
      <HStack spacing={4} modifiers={[padding({ top: 12 })]}>
        {Array.from({ length: props.setsTotal }, (_, index) => {
          const done = index < props.setsDone;
          const now = !done && index === props.setNow && !props.finished;
          // Prefer lime gradient for current; solid limeB if the gradient fill is dropped.
          const fill = done ? fillDone : now ? limeGrad : track;
          return (
            <RoundedRectangle
              key={index}
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

  /**
   * Lime-tinted system liquid glass (ActivityKit tint), not SwiftUI glassEffect.
   * clear made the banner readable but colorless; limeA restores the palette wash.
   */
  const bannerBody = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[padding({ all: 14 }), activityBackgroundTint(limeA)]}
    >
      <HStack alignment="top" spacing={12}>
        <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: 1e4 })]}>
          <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted)]}>{props.title}</Text>
          {props.exercise ? (
            <Text modifiers={[font({ size: 16, weight: "semibold" }), foregroundStyle(text)]}>{props.exercise}</Text>
          ) : null}
          {props.setLine ? (
            <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted)]}>{props.setLine}</Text>
          ) : null}
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={3}>
          {bigClock(24)}
          {props.finished ? null : resting ? (
            <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(lime)]}>{props.restLabel}</Text>
          ) : (
            <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(muted)]}>{props.elapsedLabel}</Text>
          )}
        </VStack>
      </HStack>
      {setBars}
    </VStack>
  );

  return {
    banner: bannerBody,
    compactLeading: (
      <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(text), frame({ maxWidth: 110 })]}>
        {props.exercise || props.title}
      </Text>
    ),
    compactTrailing: resting ? (
      bigClock(15, 48)
    ) : props.weightCompact ? (
      <Text modifiers={[font({ size: 12, weight: "medium", design: "monospaced" }), monospacedDigit(), foregroundStyle(lime)]}>
        {props.weightCompact}
      </Text>
    ) : (
      bigClock(15, 48)
    ),
    minimal: resting ? (
      bigClock(12, 36)
    ) : (
      <Text modifiers={[font({ size: 12, weight: "medium", design: "monospaced" }), monospacedDigit(), foregroundStyle(lime)]}>
        {props.weightCompact || props.goLabel}
      </Text>
    ),
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 4 })]}>
        <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted)]}>{props.title}</Text>
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(text)]}>
          {props.exercise || props.title}
        </Text>
      </VStack>
    ),
    expandedTrailing: bigClock(18, 64),
    expandedBottom: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ horizontal: 4 })]}>
        {props.setLine ? (
          <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle(muted)]}>{props.setLine}</Text>
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
