import { router, useNavigation } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale } from "@/components/pressable-scale";
import { SwapForm } from "@/components/swap-sheet";
import { copy, fill } from "@/copy";
import { clearSheet, currentSheet } from "@/form-sheet";
import { useSolidGlass } from "@/glass";
import { Close } from "@/icons";
import { theme } from "@/theme";
import { toDisplay, weightText } from "@/units";

/** Swap, the leg-day offer and the weight suggestion. One small detent, fitted to the content. */
export default function FitSheet() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const solid = useSolidGlass();
  const job = useRef(currentSheet()).current;
  const closed = useRef(false);

  function leave(after?: () => void) {
    if (closed.current) return;
    closed.current = true;
    after?.();
    clearSheet();
    router.back();
  }

  useEffect(() => {
    const sub = (navigation as { addListener: (event: string, cb: () => void) => () => void }).addListener("beforeRemove", () => {
      if (closed.current) return;
      closed.current = true;
      clearSheet();
    });
    return () => sub();
  }, [navigation]);

  if (!job) return null;

  return (
    <View style={[styles.sheet, { backgroundColor: solid ? theme.green.surface : "transparent", paddingBottom: Math.max(insets.bottom, 12) }]}>
      {job.kind === "swap" ? <SwapForm id={job.id} onWorkout={job.onWorkout} onClose={() => leave()} /> : null}
      {job.kind === "leg" ? (
        <View style={styles.pad}>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.workouts.swapToday}
          </Text>
          <Text style={styles.body}>{fill(copy.workouts.swapAsk, job.offer.activity, job.offer.from, job.offer.to)}</Text>
          <View style={styles.row}>
            <PressableScale kind="button" accessibilityRole="button" onPress={() => leave()} style={styles.secondary}>
              <Text style={styles.secondaryText}>{copy.workouts.keepPlan}</Text>
            </PressableScale>
            <PressableScale
              kind="button"
              accessibilityRole="button"
              onPress={() => leave(() => job.onSwap(job.offer.toId, job.offer.to))}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>{copy.workouts.swap}</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
      {job.kind === "nudge" ? (
        <View style={styles.pad}>
          <View style={styles.top}>
            <Text accessibilityRole="header" style={styles.title}>
              {job.ask.dir === "up" ? copy.workout.easyTitle : copy.workout.toughTitle}
            </Text>
            <PressableScale kind="text" accessibilityRole="button" accessibilityLabel={copy.close} onPress={() => leave()} style={styles.close}>
              <Close />
            </PressableScale>
          </View>
          <Text style={styles.body}>
            {fill(job.ask.dir === "up" ? copy.workout.repsOnUp : copy.workout.repsOnDown, job.ask.reps, job.ask.name)}{" "}
            <Text style={styles.strong}>{weightText(copy.workout.pounds, job.ask.next)}</Text>
            {` ${job.ask.dir === "up" ? copy.workout.restOfSets : copy.workout.stayInRange}`}
          </Text>
          <View style={styles.row}>
            <PressableScale kind="button" accessibilityRole="button" onPress={() => leave(() => job.onKeep?.())} style={styles.secondary}>
              <Text style={styles.secondaryText}>{fill(copy.workout.keep, toDisplay(job.ask.current))}</Text>
            </PressableScale>
            <PressableScale kind="button" accessibilityRole="button" onPress={() => leave(job.onUse)} style={styles.primary}>
              <Text style={styles.primaryText}>{fill(copy.workout.use, toDisplay(job.ask.next))}</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  pad: { paddingHorizontal: 16, paddingTop: 32, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 20, lineHeight: 24 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  body: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 20 },
  strong: { color: theme.text, fontFamily: theme.fonts.bodySemi },
  row: { flexDirection: "row", gap: 10 },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.green.accentFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryText: { color: theme.green.onAccent, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
});
