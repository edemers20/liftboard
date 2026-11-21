import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/pressable-scale";
import { copy, fill } from "@/copy";
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

/** Any lift not finished yet can be logged on an earlier day, started or not. */
export function canLogEarlier(id: string) {
  return !(engine.wk.done || {})[id] && (engine.DAYS as Day[]).some((day) => day.id === id);
}

function dateText(t: number) {
  return new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function shiftDay(t: number, by: number) {
  const next = new Date(t);
  next.setDate(next.getDate() + by);
  return next.getTime();
}

/** Open the workout that was swapped in, from the workout screen. */
export function openSwappedWorkout(nextId: string) {
  replaceWorkout(nextId);
}

export function SwapForm({
  id,
  onClose,
  onWorkout,
  onLogged,
}: {
  id: string;
  onClose: () => void;
  onWorkout?: (nextId: string) => void;
  onLogged?: (lines: string[]) => void;
}) {
  useEngineStore((state) => state.version);
  const swappable = canSwapDay(id);
  const choices = swappable ? swapChoices(id) : { family: [], others: [] };
  const loggable = !!onLogged && canLogEarlier(id);
  const range = engine.backdateRange();
  const [when, setWhen] = useState(range.max);
  const steps = [
    { by: -7, label: copy.workouts.previousWeek, Icon: ChevronsLeft, can: when > range.min },
    { by: -1, label: copy.workouts.previousDay, Icon: ChevronLeft, can: when > range.min },
    { by: 0, label: "", Icon: ChevronLeft, can: false },
    { by: 1, label: copy.workouts.nextDay, Icon: ChevronRight, can: when < range.max },
    { by: 7, label: copy.workouts.nextWeek, Icon: ChevronsRight, can: when < range.max },
  ];

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

  function logEarlier() {
    const title = engine.wTitle((engine.DAYS as Day[]).find((day) => day.id === id)?.title || copy.workouts.lift);
    const out = engine.logLiftOn(id, when);
    onClose();
    if (!out) return;
    haptic.success();
    const lines = [fill(copy.workouts.loggedOn, title, dateText(out.t)), ...(out.closed ? [copy.workouts.countsThatWeek] : [])];
    onLogged?.(lines);
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={styles.body}>
      <Text accessibilityRole="header" style={styles.title}>
        {swappable ? copy.workouts.swapWorkout : copy.workouts.logEarlier}
      </Text>
      {swappable ? <Text style={styles.note}>{copy.workouts.swapBody}</Text> : null}
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
      {loggable ? (
        <View style={styles.section}>
          {swappable ? <Text style={styles.label}>{copy.workouts.logEarlier}</Text> : null}
          <Text style={styles.note}>{copy.workouts.logEarlierBody}</Text>
          <View style={styles.dateRow}>
            {steps.map((step) =>
              step.by === 0 ? (
                <Text key="date" accessibilityLiveRegion="polite" style={styles.date}>
                  {dateText(when)}
                </Text>
              ) : (
                <PressableScale
                  key={step.by}
                  kind="button"
                  accessibilityRole="button"
                  accessibilityLabel={step.label}
                  disabled={!step.can}
                  onPress={() => {
                    haptic.selection();
                    setWhen((t) => Math.min(range.max, Math.max(range.min, shiftDay(t, step.by))));
                  }}
                  style={[styles.arrow, step.can ? null : styles.off]}
                >
                  <step.Icon size={20} strokeWidth={2} color={theme.text} />
                </PressableScale>
              ),
            )}
          </View>
          <PressableScale kind="button" accessibilityRole="button" onPress={logEarlier} style={styles.primary}>
            <Text style={styles.primaryText}>{copy.workouts.logLift}</Text>
          </PressableScale>
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
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    marginTop: 4,
  },
  arrow: { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.3 },
  date: { flex: 1, textAlign: "center", color: theme.text, fontFamily: theme.fonts.mono, fontSize: 15 },
  primary: {
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.green.accentFill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryText: { color: theme.green.onAccent, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
});
