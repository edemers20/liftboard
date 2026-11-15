import { ScrollView, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/pressable-scale";
import { copy } from "@/copy";
import { haptic } from "@/haptic";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { replaceWorkout } from "@/workout/share-box";

type Day = { id: string; tab?: string; title: string; slots: { cardio?: number }[] };

function started(id: string) {
  const day = (engine.DAYS as Day[]).find((item) => item.id === id);
  if (!day) return true;
  return day.slots.some((slot, index) => {
    const state = engine.get(id, index);
    if (slot.cardio) return !!(state.cdone || Number(state.act) > 0);
    return (state.log || []).some((row: { d?: boolean }) => row?.d);
  });
}

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
  const others = ((engine.weekModel(0).todo || []) as string[])
    .filter((next) => next !== id && !started(next))
    .map((next) => (engine.DAYS as Day[]).find((day) => day.id === next))
    .filter((day): day is Day => !!day);
  return { family, others };
}

export function canSwapDay(id: string) {
  if ((engine.wk.done || {})[id]) return false;
  if (started(id)) return false;
  const { family, others } = swapChoices(id);
  return family.length > 0 || others.length > 0;
}

/** Open the workout that was swapped in, from the workout screen. */
export function openSwappedWorkout(nextId: string) {
  replaceWorkout(nextId);
}

export function SwapForm({
  id,
  onClose,
  onWorkout,
}: {
  id: string;
  onClose: () => void;
  onWorkout?: (nextId: string) => void;
}) {
  useEngineStore((state) => state.version);
  const choices = swapChoices(id);

  function pickFamily(nextId: string) {
    onClose();
    if (!engine.swapDay(id, nextId)) return;
    haptic.medium();
    if (onWorkout) onWorkout(nextId);
  }

  function pickPlanned(nextId: string) {
    onClose();
    if (!engine.swapWeek(id, nextId)) return;
    haptic.medium();
    if (onWorkout) onWorkout(nextId);
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={styles.body}>
      <Text accessibilityRole="header" style={styles.title}>
        {copy.workouts.swapWorkout}
      </Text>
      <Text style={styles.note}>{copy.workouts.swapBody}</Text>
      {choices.family.length ? (
        <View style={styles.section}>
          <Text style={styles.label}>{copy.workouts.sameGroup}</Text>
          {choices.family.map((day) => (
            <PressableScale key={day.id} kind="surface" accessibilityRole="button" onPress={() => pickFamily(day.id)} style={styles.row}>
              <Text style={styles.rowTitle}>{day.title}</Text>
              <Text style={styles.rowDetail}>{preview(day)}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
      {choices.others.length ? (
        <View style={styles.section}>
          <Text style={styles.label}>{copy.workouts.planned}</Text>
          {choices.others.map((day) => (
            <PressableScale key={day.id} kind="surface" accessibilityRole="button" onPress={() => pickPlanned(day.id)} style={styles.row}>
              <Text style={styles.rowTitle}>{day.tab ? `${day.tab}: ${day.title}` : day.title}</Text>
              <Text style={styles.rowDetail}>{preview(day)}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16, gap: 6 },
  title: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 20, lineHeight: 24 },
  note: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 18 },
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
