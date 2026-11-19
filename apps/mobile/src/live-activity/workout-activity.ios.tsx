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
 *
 * Dynamic Island keeps its own compact/expanded trees (no Lock Screen-only modifiers like fixedSize /
 * activityBackgroundTint / wash). Island timers use a lighter lime so digits read on the black capsule.
 */
function WorkoutActivityLayout(props: WorkoutActivityProps, environment: LiveActivityEnvironment) {
  "widget";
  const limeA = "#6fd0b4";
  const limeB = "#c8e86a";
  /** Lighter rest/timer green for Island + readable digits (Emma: toward #9fcfc1 / lime-b). */
  const limeSoft = "#9fcfc1";
  const fillDone = "#237a64";
  const warn = "#e07a6a";
  const text = environment.isLuminanceReduced ? "#ffffff" : "#edeae8";
  const muted = environment.isLuminanceReduced ? "rgba(255,255,255,0.78)" : "rgba(237,234,232,0.78)";
  const track = "rgba(255,255,255,0.22)";
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
  const resting = !props.finished && props.restEnd > 0 && !environment.isStale;
  const restColor = props.restUrgent ? warn : limeSoft;
  const restRange = { lower: new Date(props.restStart || props.restEnd), upper: new Date(props.restEnd) };
  const workoutStart = props.workoutStart || Date.now();
  const elapsedRange = {
    lower: new Date(workoutStart),
    upper: new Date(workoutStart + maxLiveMs),
  };

  /** Banner clock: trailing, shrink-wrapped so it does not fight the left stack. */
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

  /**
   * Island clocks stay simple: no fixedSize / lineLimit / minimumScaleFactor (those have blanked
   * compact presentations while the Lock Screen banner still painted).
   */
  const islandClock = (size: number, width: number, color: string) =>
    props.finished ? (
      <Text modifiers={[font({ size: Math.min(size, 13), weight: "semibold" }), foregroundStyle(limeSoft)]}>{props.doneLabel}</Text>
    ) : resting ? (
      <Text
        timerInterval={restRange}
        countsDown
        modifiers={[
          font({ size, weight: "medium", design: "monospaced" }),
          monospacedDigit(),
          foregroundStyle(color),
          frame({ width, alignment: "trailing" }),
        ]}
      />
    ) : (
      <Text
        timerInterval={elapsedRange}
        countsDown={false}
        modifiers={[
          font({ size, weight: "medium", design: "monospaced" }),
          monospacedDigit(),
          foregroundStyle(color),
          frame({ width, alignment: "trailing" }),
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
      modifiers={[layoutPriority(1), frame({ minWidth: 56, alignment: "trailing" }), fixedSize({ horizontal: true, vertical: true })]}
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
          const now = !done && index === props.setNow && !props.finished;
          const fill = done ? fillDone : now ? limeBarGrad : track;
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
      {setBars()}
    </VStack>
  );

  const islandLead = props.exercise || props.title;

  return {
    banner: bannerBody,
    compactLeading: (
      <Text
        modifiers={[
          font({ size: 12, weight: "semibold" }),
          foregroundStyle(text),
          frame({ maxWidth: 160, alignment: "leading" }),
        ]}
      >
        {islandLead}
      </Text>
    ),
    compactTrailing: resting ? (
      islandClock(15, 52, restColor)
    ) : props.weightCompact ? (
      <Text
        modifiers={[
          font({ size: 12, weight: "medium", design: "monospaced" }),
          monospacedDigit(),
          foregroundStyle(limeSoft),
          frame({ maxWidth: 72, alignment: "trailing" }),
        ]}
      >
        {props.weightCompact}
      </Text>
    ) : (
      islandClock(15, 52, limeSoft)
    ),
    minimal: resting ? (
      islandClock(12, 40, restColor)
    ) : (
      <Text modifiers={[font({ size: 12, weight: "medium", design: "monospaced" }), monospacedDigit(), foregroundStyle(limeSoft)]}>
        {props.weightCompact || props.goLabel}
      </Text>
    ),
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 4 })]}>
        <Text modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(muted)]}>{props.title}</Text>
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(text)]}>{islandLead}</Text>
      </VStack>
    ),
    expandedTrailing: islandClock(18, 68, resting ? restColor : text),
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
