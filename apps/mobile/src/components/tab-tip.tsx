import { usePathname } from "expo-router";
import { PressableScale } from "@/components/pressable-scale";
import { useEffect } from "react";
import { Modal, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { copy } from "@/copy";
import { markTabTipSeen, TAB_TIP_IDS, useTabTips, watchTabTipPath, type TabTipId } from "@/tab-tips";
import { theme } from "@/theme";

function tabFromPath(path: string): TabTipId | null {
  if (path === "/" || path === "/index") return "workouts";
  if (path === "/plan" || path.startsWith("/plan/")) return "plan";
  if (path === "/history" || path.startsWith("/history/")) return "history";
  if (path === "/you" || path.startsWith("/you/")) return "you";
  return null;
}

/** First visit to each tab, after onboarding. One tap anywhere dismisses it. */
export function TabTips() {
  const path = usePathname();
  const tab = tabFromPath(path);
  const tips = useTabTips();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    watchTabTipPath(path);
  }, [path]);

  if (!tab || tips.holdPath || tips.seen[tab]) return null;

  const tip = copy.tabTips[tab];
  const index = TAB_TIP_IDS.indexOf(tab);
  const anchor = ((index + 0.5) / TAB_TIP_IDS.length) * width;
  const cardWidth = Math.min(280, width - 24);
  const left = Math.max(12, Math.min(anchor - cardWidth / 2, width - 12 - cardWidth));
  const pointerLeft = Math.max(16, Math.min(anchor - left - 8, cardWidth - 32));

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => markTabTipSeen(tab)}>
      <PressableScale
        kind="plain"
        accessibilityRole="button"
        accessibilityLabel={`${tip.title}. ${tip.body}`}
        style={styles.fill}
        onPress={() => markTabTipSeen(tab)}
      >
        <View pointerEvents="none" style={[styles.card, { left, width: cardWidth, bottom: insets.bottom + 62 }]}>
          <Text style={styles.title}>{tip.title}</Text>
          <Text style={styles.body}>{tip.body}</Text>
          <View style={[styles.pointer, { left: pointerLeft }]} />
        </View>
      </PressableScale>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  card: {
    position: "absolute",
    backgroundColor: "#2f2a27",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
  },
  title: { fontFamily: theme.fonts.bodySemi, fontSize: 13, lineHeight: 18, color: theme.text },
  body: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: theme.text },
  pointer: {
    position: "absolute",
    bottom: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#2f2a27",
  },
});
