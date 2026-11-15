import { router, useLocalSearchParams } from "expo-router";
import { PressableScale } from "@/components/pressable-scale";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  activityName,
  effortDescription,
  effortFor,
  deleteSession,
  getSession,
  heatedOn,
  saveSession,
  spinIntensity,
  useNotice,
  usesSessionEffort,
} from "@/activity-log";
import { useShownLiveWorkout } from "@/components/live-workout";
import { SheetFrame } from "@/components/motion";
import { useSolidGlass } from "@/glass";
import { copy } from "@/copy";
import { haptic } from "@/haptic";
import { useEngineStore } from "@/store";
import { theme } from "@/theme";

export default function ActivityScreen() {
  useEngineStore((state) => state.version);
  const params = useLocalSearchParams<{ t: string }>();
  const raw = Array.isArray(params.t) ? params.t[0] : params.t;
  const time = Number(raw);
  const session = getSession(time);
  const closing = useRef(false);

  const generic = !!session && usesSessionEffort(session.k);
  const [minutes, setMinutes] = useState(session?.min ? String(session.min) : "");
  const [intensity, setIntensity] = useState(spinIntensity);
  const [effort, setEffort] = useState(
    session ? (generic ? session.eff || copy.activities.moderate : effortFor(session.k)) : copy.activities.moderate,
  );
  const [heated, setHeated] = useState(heatedOn);
  const [askDelete, setAskDelete] = useState(false);
  const insets = useSafeAreaInsets();
  const solid = useSolidGlass();
  const live = useShownLiveWorkout();

  function leave() {
    if (closing.current) return;
    closing.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  useEffect(() => {
    if (!session) leave();
  }, [session]);

  if (!session) return null;

  const name = activityName(session.k);
  const showIntensity = session.k === "spin";
  const showEffort = session.k === "yoga" || session.k === "pilates";
  const showHeated = session.k === "yoga";

  function onSave() {
    saveSession(time, {
      minutes,
      intensity: showIntensity ? intensity : undefined,
      effort: showEffort || generic ? effort : undefined,
      heated: showHeated ? heated : undefined,
    });
    leave();
  }

  function confirmDelete() {
    haptic.warning();
    setAskDelete(false);
    deleteSession(time);
    useNotice.getState().show([copy.workouts.deletedToast(name)], { pulse: false });
    leave();
  }

  return (
    <SafeAreaView style={[styles.screen, !solid && styles.screenGlass]} edges={["top"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, live ? styles.contentLive : null]} keyboardShouldPersistTaps="handled">
          <PressableScale kind="text" style={styles.back} onPress={leave} accessibilityRole="button">
            <Text style={styles.backText}>{copy.workouts.back}</Text>
          </PressableScale>
          <Text accessibilityRole="header" style={styles.title}>
            {name}
          </Text>

          <View style={styles.card}>
            <Text style={styles.label} accessibilityElementsHidden>
              {copy.workouts.minutesDone}
            </Text>
            <TextInput
              value={minutes}
              onChangeText={(value) => setMinutes(value.replace(/[^\d]/g, "").slice(0, 4))}
              onSubmitEditing={onSave}
              keyboardType="number-pad"
              inputMode="numeric"
              accessibilityLabel={copy.workouts.minutesDone}
              style={styles.input}
              selectionColor={theme.pink.accent}
            />

            {showIntensity ? (
              <PillField
                label={copy.activities.intensity}
                value={intensity}
                options={[copy.activities.hard, copy.activities.reallyHard]}
                onChange={setIntensity}
              />
            ) : null}

            {generic ? (
              <PillField
                label={copy.workouts.difficulty}
                value={effort}
                options={["Easy", "Moderate", "Hard"]}
                labelFor={(option) =>
                  option === "Easy" ? copy.workouts.easy : option === "Hard" ? copy.activities.hard : copy.activities.moderate
                }
                onChange={setEffort}
              />
            ) : null}

            {showEffort ? (
              <View style={styles.field}>
                <PillField
                  label={copy.activities.effort}
                  value={effort}
                  options={[copy.activities.light, copy.activities.moderate, copy.activities.hard]}
                  onChange={setEffort}
                />
                <Text style={styles.description}>{effortDescription(session.k, effort)}</Text>
              </View>
            ) : null}

            {showHeated ? (
              <View style={styles.heated}>
                <Text style={styles.label}>{copy.activities.heated}</Text>
                <View
                  style={styles.segments}
                  accessibilityRole="radiogroup"
                  accessibilityLabel={copy.activities.heated}
                >
                  <PressableScale
                    style={[styles.segment, !heated && styles.segmentOn]}
                    onPress={() => {
                      if (heated) haptic.selection();
                      setHeated(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: !heated }}
                  >
                    <Text style={[styles.segmentText, !heated && styles.segmentTextOn]}>{copy.activities.notHeated}</Text>
                  </PressableScale>
                  <PressableScale
                    style={[styles.segment, heated && styles.segmentOn]}
                    onPress={() => {
                      if (!heated) haptic.selection();
                      setHeated(true);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: heated }}
                  >
                    <Text style={[styles.segmentText, heated && styles.segmentTextOn]}>{copy.activities.heated}</Text>
                  </PressableScale>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <PressableScale
              style={styles.delete}
              onPress={() => setAskDelete(true)}
              accessibilityRole="button"
            >
              <Text style={styles.deleteText}>{copy.workouts.delete}</Text>
            </PressableScale>
            <PressableScale
              kind="surface"
              style={styles.save}
              onPress={onSave}
              accessibilityRole="button"
            >
              <Text style={styles.saveText}>{copy.workouts.save}</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <SheetFrame visible={askDelete} onClose={() => setAskDelete(false)} label={copy.you.cancel}>
        <View style={[styles.sheet, { marginBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetButtons}>
            <PressableScale accessibilityRole="button" onPress={() => setAskDelete(false)} style={styles.sheetCancel}>
              <Text style={styles.sheetCancelText}>{copy.you.cancel}</Text>
            </PressableScale>
            <PressableScale accessibilityRole="button" onPress={confirmDelete} style={styles.sheetDelete}>
              <Text style={styles.sheetDeleteText}>{copy.workouts.delete}</Text>
            </PressableScale>
          </View>
        </View>
      </SheetFrame>
    </SafeAreaView>
  );
}

function PillField({
  label,
  value,
  options,
  onChange,
  labelFor,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  labelFor?: (option: string) => string;
}) {
  return (
    <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pills}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <PressableScale
              key={option}
              style={[styles.pill, selected && styles.pillOn]}
              onPress={() => {
                if (option !== value) haptic.selection();
                onChange(option);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.pillText, selected && styles.pillTextOn]}>{labelFor ? labelFor(option) : option}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.pink.background,
  },
  screenGlass: { backgroundColor: "transparent" },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  contentLive: {
    paddingBottom: 96,
  },
  back: {
    minHeight: 44,
    alignSelf: "flex-start",
    justifyContent: "center",
  },
  backText: {
    color: theme.pink.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
  },
  title: {
    color: theme.text,
    fontFamily: theme.fonts.display,
    fontSize: 32,
    lineHeight: 34,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: theme.pink.surface,
    borderRadius: theme.radii.card,
    padding: 16,
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: theme.pink.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.pink.input,
    color: theme.text,
    fontFamily: theme.fonts.monoMedium,
    fontSize: 18,
    paddingHorizontal: 12,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.pink.input,
    alignItems: "center",
    justifyContent: "center",
  },
  pillOn: {
    backgroundColor: theme.pink.tint,
  },
  pillText: {
    color: theme.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
  },
  pillTextOn: {
    color: theme.pink.accent,
  },
  description: {
    color: theme.muted,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  heated: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  segments: {
    flexDirection: "row",
    backgroundColor: theme.pink.input,
    borderRadius: theme.radii.pill,
    padding: 3,
  },
  segment: {
    minHeight: 40,
    minWidth: 52,
    paddingHorizontal: 12,
    borderRadius: theme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentOn: {
    backgroundColor: theme.pink.tint,
  },
  segmentText: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
  },
  segmentTextOn: {
    color: theme.pink.accent,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  delete: {
    flex: 1,
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.pink.secondary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  deleteText: {
    color: theme.pink.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 16,
  },
  save: {
    flex: 1,
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.pink.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  saveText: {
    color: theme.pink.onAccent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.72,
  },
  sheet: {
    marginHorizontal: 12,
    backgroundColor: theme.pink.surface,
    borderRadius: 24,
    padding: 16,
    gap: 16,
  },
  sheetTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 20 },
  sheetButtons: { flexDirection: "row", gap: 8 },
  sheetCancel: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancelText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  sheetDelete: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: theme.pink.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetDeleteText: { color: theme.pink.onAccent, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
});
