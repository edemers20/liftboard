import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/** The browser has no native animation module. `true` there only logs a warning. */
export const nativeDriver = Platform.OS !== "web";

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let current = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (current) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
