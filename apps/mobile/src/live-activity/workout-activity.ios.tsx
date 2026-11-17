import { HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { background, font, foregroundStyle, frame, monospacedDigit, padding, tint } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment, type LiveActivityFactory } from "expo-widgets";

import type { WorkoutActivityProps } from "./state";

/**
 * Lock Screen and Dynamic Island layout. It runs in the widget extension's own runtime: everything it uses is
 * declared inside the function. The countdown is a system timer, and the activity goes stale at the rest end,
 * so "Go" shows without the app running. The extension has no DM Mono, so digits use the system monospaced font.
 */
function WorkoutActivityLayout(props: WorkoutActivityProps, environment: LiveActivityEnvironment) {
  "widget";
  const green = environment.isLuminanceReduced ? "#ffffff" : "#6fd0b4";
  const orange = environment.isLuminanceReduced ? "#ffffff" : "#fea06a";
  const text = "#edeae8";
  const muted = "#a8a09c";
  const resting = !props.finished && props.restEnd > 0 && !environment.isStale;
  const range = { lower: new Date(props.restStart || props.restEnd), upper: new Date(props.restEnd) };
  const progress = props.setsTotal > 0 ? Math.min(1, props.setsDone / props.setsTotal) : 0;
  const detail = [props.exercise, props.setLine].filter(Boolean).join(", ");

  const clock = (size: number, width?: number) =>
    props.finished ? (
      <Text modifiers={[font({ size, weight: "semibold" }), foregroundStyle(green)]}>{props.doneLabel}</Text>
    ) : resting ? (
      <Text
        timerInterval={range}
        countsDown
        modifiers={[
          font({ size, weight: "medium", design: "monospaced" }),
          monospacedDigit(),
          foregroundStyle(green),
          ...(width ? [frame({ width })] : []),
        ]}
      />
    ) : (
      <Text modifiers={[font({ size, weight: "semibold" }), foregroundStyle(orange)]}>{props.goLabel}</Text>
    );

  const bar = <ProgressView value={progress} modifiers={[tint(green)]} />;

  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 16 }), background("#181513")]}>
        <HStack spacing={8}>
          <Text modifiers={[font({ size: 15, weight: "semibold" }), foregroundStyle(text)]}>{props.title}</Text>
          <Spacer />
          {resting ? <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>{props.restLabel}</Text> : null}
          {clock(20)}
        </HStack>
        {detail ? <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>{detail}</Text> : null}
        {bar}
      </VStack>
    ),
    compactLeading: <Image systemName="dumbbell.fill" color={green} />,
    compactTrailing: clock(15, 48),
    minimal: resting ? clock(12, 36) : <Image systemName="dumbbell.fill" color={green} />,
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 4 })]}>
        <Image systemName="dumbbell.fill" color={green} />
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(text)]}>{props.title}</Text>
      </HStack>
    ),
    expandedTrailing: clock(18, 64),
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 4 })]}>
        {detail ? <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>{detail}</Text> : null}
        {bar}
      </VStack>
    ),
  };
}

export const WorkoutActivity: LiveActivityFactory<WorkoutActivityProps> | null = createLiveActivity<WorkoutActivityProps>(
  "WorkoutActivity",
  WorkoutActivityLayout,
);
