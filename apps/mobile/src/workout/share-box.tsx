import type { ReactNode } from "react";
import { Link, router } from "expo-router";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, SharedTransition } from "react-native-reanimated";

import { PressableScale } from "@/components/pressable-scale";
import { useReduceMotion } from "@/use-reduce-motion";

export const WORKOUT_OPEN_MS = 240;
export const WORKOUT_CLOSE_MS = 200;

/** Ease-out, no overshoot. Call markWorkoutOpen / markWorkoutClose before the move. */
export const liftMove = SharedTransition.duration(WORKOUT_OPEN_MS).easing(Easing.out(Easing.cubic));

export type WorkoutEnter = "expand" | "plain";

let enter: WorkoutEnter = "plain";
const listeners = new Set<(mode: WorkoutEnter) => void>();

function emit() {
  listeners.forEach((listener) => listener(enter));
}

export function workoutEnter(): WorkoutEnter {
  return enter;
}

export function subscribeWorkoutEnter(listener: (mode: WorkoutEnter) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function markWorkoutOpen(next: WorkoutEnter) {
  enter = next;
  liftMove.duration(WORKOUT_OPEN_MS);
  emit();
}

export function markWorkoutClose() {
  liftMove.duration(WORKOUT_CLOSE_MS);
  emit();
}

/** Wait until the stack has the new animation option, then navigate. */
function afterPaint(go: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(go);
  });
}

export function openWorkout(id: string, how: WorkoutEnter) {
  markWorkoutOpen(how);
  afterPaint(() => {
    router.push({ pathname: "/workout/[id]", params: { id } });
  });
}

export function replaceWorkout(id: string) {
  markWorkoutOpen("plain");
  afterPaint(() => {
    router.replace({ pathname: "/workout/[id]", params: { id } });
  });
}

/** The day card grows into the workout. iOS uses the system zoom; other platforms keep the shared move. */
export function WorkoutLink({
  id,
  style,
  children,
}: {
  id: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const flat = StyleSheet.flatten(style);
  if (Platform.OS !== "ios" || reduce) {
    return (
      <PressableScale
        kind="surface"
        accessibilityRole={Platform.OS === "web" ? undefined : "button"}
        onPress={() => openWorkout(id, reduce ? "plain" : "expand")}
        style={flat}
      >
        {children}
      </PressableScale>
    );
  }
  return (
    <Link href={{ pathname: "/workout/[id]", params: { id } }} asChild>
      <Link.Trigger withAppleZoom>
        <PressableScale kind="surface" accessibilityRole="button" style={flat}>
          {children}
        </PressableScale>
      </Link.Trigger>
    </Link>
  );
}
export function ShareBox({
  tag,
  style,
  children,
}: {
  tag?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  if (reduceMotion || !tag || Platform.OS === "ios") return <View style={style}>{children}</View>;
  return (
    <Animated.View sharedTransitionTag={tag} sharedTransitionStyle={liftMove} style={style}>
      {children}
    </Animated.View>
  );
}
