import { isGlassEffectAPIAvailable } from "expo-glass-effect";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

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
