import { router } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNotice } from "@/activity-log";
import { useEnterMotion } from "@/components/motion";
import { copy, fill } from "@/copy";
import { haptic } from "@/haptic";
import { Close } from "@/icons";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";

type Day = { id: string; title: string; slots: { cardio?: number }[] };

function preview(day: Day) {
  return day.slots
    .map((slot, index) => ({ slot, index }))
    .filter((row) => !row.slot.cardio)
    .slice(0, 3)
    .map((row) => engine.exName(day, row.slot, row.index))
    .join(" · ");
}

export function swapChoices(id: string) {
  const family = ((engine.swapOptions(id) || []) as Day[]).filter((day) => day.id !== id);
  const todayId = engine.earlyDone() ? null : (engine.dayBoard(0).plannedId as string | null);
  const others =
    id === todayId
      ? (((engine.weekModel(0).todo || []) as string[])
          .filter((next) => next !== id)
          .map((next) => (engine.DAYS as Day[]).find((day) => day.id === next))
          .filter((day): day is Day => !!day))
      : [];
  return { family, others };
}

export type SwapAnchor = { x: number; y: number; width: number; height: number };

export function canSwapDay(id: string) {
  if ((engine.wk.done || {})[id]) return false;
  if (((engine.wk.wt || {})[id] || {}).start) return false;
  const { family, others } = swapChoices(id);
  return family.length > 0 || others.length > 0;
}

export function SwapSheet({
  id,
  anchor,
  onClose,
  onWorkout,
}: {
  id: string | null;
  anchor: SwapAnchor | null;
  onClose: () => void;
  /** When the workout screen is open, follow the chosen id. */
  onWorkout?: (nextId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { dimStyle, sheetStyle } = useEnterMotion(!!id);
  const { width: screenW, height: screenH } = useWindowDimensions();
  useEngineStore((state) => state.version);
  const choices = id ? swapChoices(id) : { family: [], others: [] };
  const cardW = Math.min(360, screenW - 24);
  const left = anchor
    ? Math.max(12, Math.min(anchor.x + anchor.width - cardW, screenW - 12 - cardW))
    : (screenW - cardW) / 2;
  const below = anchor ? anchor.y + anchor.height + 6 : screenH * 0.22;
  const spaceBelow = screenH - insets.bottom - below;
  const above = anchor != null && spaceBelow < 220 && anchor.y > 240;
  const place =
    above && anchor
      ? { left, bottom: screenH - anchor.y + 6, width: cardW, maxHeight: anchor.y - insets.top - 16 }
      : { left, top: below, width: cardW, maxHeight: Math.max(180, spaceBelow - 8) };

  function pickFamily(nextId: string) {
    if (!id) return;
    onClose();
    if (!engine.swapDay(id, nextId)) return;
    haptic.medium();
    if (onWorkout) onWorkout(nextId);
  }

  function pickPlanned(nextId: string) {
    if (!id) return;
    onClose();
    haptic.medium();
    engine.moveLiftToToday(nextId);
    const title = (engine.DAYS as Day[]).find((day) => day.id === nextId)?.title || copy.workouts.lift;
    useNotice.getState().show([fill(copy.workouts.moved, title)]);
    if (onWorkout) onWorkout(nextId);
  }

  return (
    <Modal visible={!!id} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.dim}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dimColor, dimStyle]} />
        <Pressable accessibilityRole="button" accessibilityLabel={copy.close} style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, place, sheetStyle]}>
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={styles.sheetBody}>
            <View style={styles.top}>
              <Text accessibilityRole="header" style={styles.title}>
                {copy.workouts.swapWorkout}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.close}
                hitSlop={12}
                onPress={onClose}
                style={styles.close}
              >
                <Close />
              </Pressable>
            </View>
            <Text style={styles.body}>{copy.workouts.swapBody}</Text>
            {choices.family.length ? (
              <View style={styles.section}>
                <Text style={styles.label}>{copy.workouts.sameGroup}</Text>
                {choices.family.map((day) => (
                  <Pressable key={day.id} accessibilityRole="button" onPress={() => pickFamily(day.id)} style={styles.row}>
                    <Text style={styles.rowTitle}>{day.title}</Text>
                    <Text style={styles.rowDetail}>{preview(day)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {choices.others.length ? (
              <View style={styles.section}>
                <Text style={styles.label}>{copy.workouts.planned}</Text>
                {choices.others.map((day) => (
                  <Pressable key={day.id} accessibilityRole="button" onPress={() => pickPlanned(day.id)} style={styles.row}>
                    <Text style={styles.rowTitle}>{day.title}</Text>
                    <Text style={styles.rowDetail}>{preview(day)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Open the workout that was swapped in, from the workout screen. */
export function openSwappedWorkout(nextId: string) {
  router.replace({ pathname: "/workout/[id]", params: { id: nextId } });
}

const styles = StyleSheet.create({
  dim: { flex: 1 },
  dimColor: { backgroundColor: "rgba(0,0,0,0.75)" },
  sheet: {
    position: "absolute",
    borderRadius: theme.radii.card,
    backgroundColor: theme.green.surface,
    overflow: "hidden",
  },
  sheetBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 6 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 20, lineHeight: 24 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  body: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 18 },
  section: { gap: 6 },
  label: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
    marginTop: 8,
  },
  row: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  rowTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  rowDetail: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 13 },
});
