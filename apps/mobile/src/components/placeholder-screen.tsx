import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/theme";

export function PlaceholderScreen({ title, background }: { title: string; background: string }) {
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: background }]} edges={["top"]}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  title: {
    color: theme.text,
    fontFamily: theme.fonts.display,
    fontSize: 34,
    textTransform: "uppercase",
  },
});
