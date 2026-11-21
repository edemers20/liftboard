import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";

import { useNotice } from "@/activity-log";
import { PressableScale } from "@/components/pressable-scale";
import { copy, fill } from "@/copy";
import { openFitSheet } from "@/form-sheet";
import { haptic } from "@/haptic";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { fromDisplay, unitWord } from "@/units";

type Slot = { cardio?: number; reps?: string };
type Day = { id: string; tab?: string; title: string; slots: Slot[] };
type Row = { index: number; name: string; bodyweight: boolean; reps: string };
type Draft = { weight: string; reps: string; sets: string };
const EMPTY: Draft = { weight: "", reps: "", sets: "" };

function dayStart(offset: number) {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + offset);
  return day.getTime();
}

function liftDays(): Day[] {
  return engine.DAYS as Day[];
}

function choicesOn(day: number) {
  const { next, other, closed } = engine.retroChoices(day);
  const byId = (id: string) => liftDays().find((item) => item.id === id);
  return {
    closed,
    next: next.map(byId).filter((item): item is Day => !!item),
    other: other.map(byId).filter((item): item is Day => !!item),
  };
}

/** Past days in reach with no lift logged yet. */
export function canAddWorkout(offset: number) {
  if (offset >= 0 || !engine.wk.setupDone || !liftDays().length) return false;
  const day = dayStart(offset);
  const range = engine.backdateRange();
  if (day < range.min || day > range.max) return false;
  const board = engine.dayBoard(offset) as { sessions: { k: string }[] };
  return !board.sessions.some((session) => session.k === "lift");
}

export function AddWorkoutButton({ offset }: { offset: number }) {
  "use no memo";
  useEngineStore((state) => state.version);
  if (!canAddWorkout(offset)) return null;
  return (
    <View style={styles.chips}>
      <PressableScale
        style={styles.chip}
        accessibilityRole="button"
        accessibilityLabel={copy.workouts.addWorkout}
        onPress={() => {
          haptic.selection();
          openFitSheet({ kind: "retro", day: dayStart(offset) });
        }}
      >
        <Text style={styles.plus}>+</Text>
        <Text style={styles.chipName}>{copy.workouts.addWorkout}</Text>
      </PressableScale>
    </View>
  );
}

function dateText(t: number) {
  return new Date(t).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function rowsFor(day: Day): Row[] {
  return (engine.slotOrder(day) as number[])
    .filter((index) => !day.slots[index].cardio)
    .map((index) => {
      const name = engine.exName(day, day.slots[index], index) as string;
      return { index, name, bodyweight: !!engine.isBW(name), reps: String(day.slots[index].reps || "") };
    });
}

/** Sheet body: pick the lift, then optional sets, then save it on that day. */
export function RetroLiftForm({ day, onClose }: { day: number; onClose: () => void }) {
  "use no memo";
  useEngineStore((state) => state.version);
  const { height } = useWindowDimensions();
  const [picked, setPicked] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const choices = choicesOn(day);
  const lift = picked ? liftDays().find((item) => item.id === picked) || null : null;

  function edit(index: number, key: keyof Draft, value: string) {
    setDrafts((all) => ({ ...all, [index]: { ...(all[index] || EMPTY), [key]: value } }));
  }

  function save() {
    if (!lift) return;
    const sets: Record<number, { w: string; r: string }[]> = {};
    Object.entries(drafts).forEach(([index, draft]) => {
      const reps = parseInt(draft.reps, 10);
      if (!(reps > 0)) return;
      const count = Math.min(10, Math.max(1, parseInt(draft.sets, 10) || 1));
      sets[+index] = Array.from({ length: count }, () => ({ w: fromDisplay(draft.weight.trim()), r: String(reps) }));
    });
    const out = engine.logLiftOn(lift.id, day, undefined, sets);
    onClose();
    if (!out) return;
    haptic.success();
    useNotice
      .getState()
      .show([fill(copy.workouts.loggedOn, engine.wTitle(lift.title), dateText(out.t))], { pulse: false });
  }

  function option(item: Day) {
    return (
      <PressableScale
        key={item.id}
        kind="surface"
        accessibilityRole="button"
        onPress={() => {
          haptic.selection();
          setPicked(item.id);
          setDrafts({});
        }}
        style={styles.row}
      >
        <Text style={styles.rowTitle}>{engine.wTitle(item.title)}</Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          {rowsFor(item)
            .slice(0, 3)
            .map((row) => row.name)
            .join(", ")}
        </Text>
      </PressableScale>
    );
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" bounces={false} style={{ maxHeight: height * 0.8 }} contentContainerStyle={styles.body}>
      <Text accessibilityRole="header" style={styles.title}>
        {lift ? engine.wTitle(lift.title) : copy.workouts.addWorkout}
      </Text>
      <Text style={styles.date}>{dateText(day)}</Text>
      {!lift ? (
        <>
          <Text style={styles.note}>{choices.next.length || choices.other.length ? copy.workouts.addWorkoutBody : copy.workouts.allLiftsDone}</Text>
          {choices.next.length ? (
            <View style={styles.section}>
              <Text style={styles.label}>{copy.workout.upNext}</Text>
              {choices.next.map(option)}
            </View>
          ) : null}
          {choices.other.length ? (
            <View style={styles.section}>
              <Text style={styles.label}>{copy.workouts.otherLifts}</Text>
              {choices.other.map(option)}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.note}>{copy.workouts.setsOptional}</Text>
          {rowsFor(lift).map((row) => {
            const draft = drafts[row.index] || EMPTY;
            return (
              <View key={row.index} style={styles.exercise}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {row.name}
                </Text>
                <View style={styles.fields}>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{unitWord(row.bodyweight)}</Text>
                    <TextInput
                      accessibilityLabel={`${row.name} ${unitWord(row.bodyweight)}`}
                      value={draft.weight}
                      onChangeText={(value) => edit(row.index, "weight", value)}
                      keyboardType="decimal-pad"
                      placeholder={row.bodyweight ? "BW" : ""}
                      placeholderTextColor={theme.muted}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{copy.workout.reps}</Text>
                    <TextInput
                      accessibilityLabel={`${row.name} ${copy.workout.reps}`}
                      value={draft.reps}
                      onChangeText={(value) => edit(row.index, "reps", value)}
                      keyboardType="number-pad"
                      placeholder={row.reps}
                      placeholderTextColor={theme.muted}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{copy.history.sets}</Text>
                    <TextInput
                      accessibilityLabel={`${row.name} ${copy.history.sets}`}
                      value={draft.sets}
                      onChangeText={(value) => edit(row.index, "sets", value)}
                      keyboardType="number-pad"
                      placeholder="1"
                      placeholderTextColor={theme.muted}
                      style={styles.input}
                    />
                  </View>
                </View>
              </View>
            );
          })}
          <View style={styles.buttons}>
            <PressableScale kind="button" accessibilityRole="button" onPress={() => setPicked(null)} style={styles.secondary}>
              <Text style={styles.secondaryText}>{copy.workouts.back}</Text>
            </PressableScale>
            <PressableScale kind="button" accessibilityRole="button" onPress={save} style={styles.primary}>
              <Text style={styles.primaryText}>{copy.workouts.saveWorkout}</Text>
            </PressableScale>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.green.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  plus: { color: theme.green.accent, fontFamily: theme.fonts.body, fontSize: 17, lineHeight: 20 },
  chipName: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  body: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16, gap: 6 },
  title: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 20, lineHeight: 24 },
  date: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 15 },
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
  row: { backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  rowTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  rowDetail: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 13 },
  exercise: { backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 12, gap: 8, marginTop: 4 },
  fields: { flexDirection: "row", gap: 8 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  input: {
    minHeight: 44,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.green.surface,
    color: theme.text,
    fontFamily: theme.fonts.mono,
    fontSize: 16,
    paddingHorizontal: 10,
  },
  buttons: { flexDirection: "row", gap: 10, marginTop: 8 },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  primary: {
    flex: 2,
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.green.accentFill,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: theme.green.onAccent, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
});
