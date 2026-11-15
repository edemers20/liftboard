import { type ReactElement } from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { ScrollViewMarker } from "react-native-screens/src/components/gamma/scroll-view-marker/ScrollViewMarker";

import { useShownLiveWorkout } from "@/components/live-workout";

/**
 * The native tab bar draws over the screen. These lists keep their own bottom
 * padding, so UIKit does not inset them. This spacer keeps the last row clear.
 * A live workout adds the pill that floats above the bar.
 */
export function TabBarSpacer() {
  const live = useShownLiveWorkout();
  if (Platform.OS !== "ios") return null;
  return <View style={{ height: live ? 168 : 88 }} />;
}

const HIDDEN_EDGES = { top: "hidden", bottom: "hidden", left: "hidden", right: "hidden" } as const;

/**
 * Tells the native tab bar which list to follow for minimize-on-scroll.
 * The child has to be the scroll view itself. Only the active list should be
 * wrapped; a later registration replaces the earlier one.
 */
export function TabScrollMarker({
  active = true,
  style,
  children,
}: {
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactElement;
}) {
  if (Platform.OS !== "ios" || !active) return children;
  return (
    <ScrollViewMarker style={[{ flex: 1 }, style]} scrollEdgeEffects={HIDDEN_EDGES}>
      {children}
    </ScrollViewMarker>
  );
}
