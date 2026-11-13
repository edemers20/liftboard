import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, SharedTransition } from "react-native-reanimated";

import { useReduceMotion } from "@/use-reduce-motion";

/** Same curve as the web card-to-header move (0.45s). */
const liftMove = SharedTransition.duration(450).easing(Easing.bezier(0.2, 0.8, 0.2, 1));

/** The day card grows into the workout header. Reduce Motion keeps a plain view. */
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
  if (reduceMotion || !tag) return <View style={style}>{children}</View>;
  return (
    <Animated.View sharedTransitionTag={tag} sharedTransitionStyle={liftMove} style={style}>
      {children}
    </Animated.View>
  );
}
