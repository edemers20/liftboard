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
 * Lock Screen and Dynamic Island layout. It runs in the widget extension's own runtime: everything it uses is
 * declared inside the function (no module-scope values).
 *
 * Lock Screen chrome: system liquid glass via `activityBackgroundTint("clear")` plus the design-lock lime wash
 * `#6fd0b4→#c8e86a` as a background gradient. Never `glassEffect` (blanks the banner).
 */
function WorkoutActivityLayout(props: WorkoutActivityProps, environment: LiveActivityEnvironment) {
  "widget";
  const limeA = "#6fd0b4";
  const limeB = "#c8e86a";
  const fillDone = "#237a64";
  const warn = "#e07a6a";
  const text = environment.isLuminanceReduced ? "#ffffff" : "#edeae8";
  const muted = environment.isLuminanceReduced ? "rgba(255,255,255,0.78)" : "rgba(237,234,232,0.78)";
  const track = "rgba(255,255,255,0.22)";
  const lime = limeA;
  const limeBarGrad = {
    type: "linearGradient" as const,
    colors: [limeA, limeB],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 0 },
  };
  /** Viz wash: 135° lime→chartreuse over dark glass (live-glass-lime-v5). */
  const limeWash = {
    type: "linearGradient" as const,
    colors: ["rgba(111,208,180,0.50)", "rgba(200,232,106,0.38)"],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 },
  };
  const maxLiveMs = 8 * 3600e3;
  const restColor = props.restUrgent ? warn : lime;
  const resting = !props.finished && props.restEnd > 0 && !environment.isStale;
  const restRange = { lower: new Date(props.restStart || props.restEnd), upper: new Date(props.restEnd) };
  const workoutStart = props.workoutStart || Date.now();
  const elapsedRange = {
    lower: new Date(workoutStart),
    upper: new Date(workoutStart + maxLiveMs),
  };

  const clockText = (size: number, color: string, opts?: { width?: number; banner?: boolean }) => {
    const base = [
      font({ size, weight: "medium", design: "monospaced" }),
      monospacedDigit(),
      foregroundStyle(color),
      multilineTextAlignment("trailing"),
      lineLimit(1),
      minimumScaleFactor(0.75),
    ];
    if (opts?.banner) {
      return [...base, fixedSize({ horizontal: true, vertical: true })];
    }
    if (opts?.width) {
      return [...base, frame({ width: opts.width, alignment: "trailing" })];
    }
    return base;
  };

  const bigClock = (size: number, opts?: { width?: number; banner?: boolean }) =>
    props.finished ? (
      <Text modifiers={[font({ size, weight: "semibold" }), foregroundStyle(lime), multilineTextAlignment("trailing"), lineLimit(1)]}>
        {props.doneLabel}
      </Text>
    ) : resting ? (
      <Text timerInterval={restRange} countsDown modifiers={clockText(size, restColor, opts)} />
    ) : (
      <Text timerInterval={elapsedRange} countsDown={false} modifiers={clockText(size, text, opts)} />
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

  /** Right column: timer on top, muted rest/elapsed under; shrink-wrap, no overlap with the left stack. */
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
    props.setsTotal > 0 ? (
      <HStack spacing={4} modifiers={[padding({ top: 12 })]}>
        {Array.from({ length: props.setsTotal }, (_, index) => {
          const done = index < props.setsDone;
          const now = !done && index === props.setNow && !props.finished;
          const fill = done ? fillDone : now ? limeBarGrad : track;
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

  const bannerBody = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[padding({ all: 14 }), activityBackgroundTint("clear"), background(limeWash)]}
    >
      <HStack alignment="top" spacing={12}>
        <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(0), frame({ maxWidth: 9999, alignment: "leading" })]}>
          <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{props.title}</Text>
          {props.exercise ? (
            <Text modifiers={[font({ size: 16, weight: "semibold" }), foregroundStyle(text), lineLimit(2)]}>{props.exercise}</Text>
          ) : null}
          {props.setLine ? (
            <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{props.setLine}</Text>
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
      <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(text), frame({ maxWidth: 110 }), lineLimit(1)]}>
        {props.exercise || props.title}
      </Text>
    ),
    compactTrailing: resting ? (
      bigClock(15, { width: 48 })
    ) : props.weightCompact ? (
      <Text modifiers={[font({ size: 12, weight: "medium", design: "monospaced" }), monospacedDigit(), foregroundStyle(lime), lineLimit(1)]}>
        {props.weightCompact}
      </Text>
    ) : (
      bigClock(15, { width: 48 })
    ),
    minimal: resting ? (
      bigClock(12, { width: 36 })
    ) : (
      <Text modifiers={[font({ size: 12, weight: "medium", design: "monospaced" }), monospacedDigit(), foregroundStyle(lime), lineLimit(1)]}>
        {props.weightCompact || props.goLabel}
      </Text>
    ),
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 4 })]}>
        <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{props.title}</Text>
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(text), lineLimit(1)]}>
          {props.exercise || props.title}
        </Text>
      </VStack>
    ),
    expandedTrailing: bigClock(18, { width: 64 }),
    expandedBottom: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ horizontal: 4 })]}>
        {props.setLine ? (
          <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle(muted), lineLimit(1)]}>{props.setLine}</Text>
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
