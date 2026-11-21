import { isGlassEffectAPIAvailable } from "expo-glass-effect";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/** Lime glass shared by the live workout pill and the workout header buttons. */
export const LIME_GLASS = {
  tint: "rgba(111,208,180,0.35)",
  wash: ["rgba(111,208,180,0.42)", "rgba(200,232,106,0.28)"] as const,
  washOpacity: 0.55,
  edge: "rgba(200,232,106,0.32)",
};

/** True when Liquid Glass can draw. False on older iOS, other platforms and Reduce Transparency. */
export function useSolidGlass(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    // iOS only; React Native Web has no isReduceTransparencyEnabled and throws.
    if (Platform.OS !== "ios") return;
    let live = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((on) => {
        if (live) setReduce(on);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  if (Platform.OS !== "ios" || reduce) return true;
  try {
    return !isGlassEffectAPIAvailable();
  } catch {
    return true;
  }
}
