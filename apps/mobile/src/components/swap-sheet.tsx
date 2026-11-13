import { router } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNotice } from "@/activity-log";
import { copy, fill } from "@/copy";
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

export function canSwapDay(id: string) {
  if ((engine.wk.done || {})[id]) return false;
  if (((engine.wk.wt || {})[id] || {}).start) return false;
  const { family, others } = swapChoices(id);
  return family.length > 0 || others.length > 0;
}

export function SwapSheet({
  id,
  onClose,
  onWorkout,
}: {
  id: string | null;
  onClose: () => void;
  /** When the workout screen is open, follow the chosen id. */
  onWorkout?: (nextId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  useEngineStore((state) => state.version);
  const choices = id ? swapChoices(id) : { family: [], others: [] };

  function pickFamily(nextId: string) {
    if (!id) return;
    onClose();
    if (!engine.swapDay(id, nextId)) return;
    if (onWorkout) onWorkout(nextId);
  }

  function pickPlanned(nextId: string) {
    if (!id) return;
    onClose();
    engine.moveLiftToToday(nextId);
    const title = (engine.DAYS as Day[]).find((day) => day.id === nextId)?.title || copy.workouts.lift;
    useNotice.getState().show([fill(copy.workouts.moved, title)]);
    if (onWorkout) onWorkout(nextId);
  }

  return (
    <Modal visible={!!id} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.close} style={styles.dim} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { marginBottom: insets.bottom + 12 }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.top}>
            <Text accessibilityRole="header" style={styles.title}>
              {copy.workouts.swapWorkout}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>×</Text>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Open the workout that was swapped in, from the workout screen. */
export function openSwappedWorkout(nextId: string) {
  router.replace({ pathname: "/workout/[id]", params: { id: nextId } });
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: {
    marginHorizontal: 12,
    borderRadius: theme.radii.card,
    backgroundColor: theme.green.surface,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 6,
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 },
  title: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 20 },
  close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  closeText: { color: theme.text, fontSize: 22, lineHeight: 24 },
  body: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 14 },
  section: { gap: 6, marginTop: 2 },
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
