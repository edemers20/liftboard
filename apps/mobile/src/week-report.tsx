import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { create } from "zustand";

import { SheetFrame, useCountUp } from "@/components/motion";
import { copy } from "@/copy";
import { haptic } from "@/haptic";
import { openPlan } from "@/links";
import { engine } from "@/store";
import { theme } from "@/theme";

type WeekRec = { start?: number; lifts?: number; planned?: number; cardio?: number; w?: number };

export type WeekReport = {
  lifts: number;
  planned: number;
  burn: number;
  weight: number | null;
  signed: boolean;
};

type ReportState = {
  id: number;
  report: WeekReport | null;
  clear: () => void;
};

export const useWeekReport = create<ReportState>((set) => ({
  id: 0,
  report: null,
  clear: () => set({ report: null }),
}));

/** Open the weekly report from a week that just closed. */
export function presentWeekReport(summary?: { lifts?: number; planned?: number; cardio?: number }) {
  const weeks = (engine.wk.weeks || []) as WeekRec[];
  const latest = weeks[weeks.length - 1];
  const previous = weeks[weeks.length - 2];
  if (!latest && !summary) return;
  let weight: number | null = null;
  let signed = false;
  if (latest?.w && previous?.w) {
    weight = latest.w - previous.w;
    signed = true;
  } else if (latest?.w) {
    weight = latest.w;
  }
  const start = latest?.start;
  const burn = summary?.cardio ?? (start != null ? engine.weekActuals(start).burn : (latest?.cardio ?? 0));
  useWeekReport.setState((state) => ({
    id: state.id + 1,
    report: {
      lifts: summary?.lifts ?? latest?.lifts ?? 0,
      planned: summary?.planned ?? latest?.planned ?? 0,
      burn,
      weight,
      signed,
    },
  }));
}

function formatWeight(value: number, signed: boolean) {
  const body = Math.abs(value).toFixed(1);
  if (!signed) return body;
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}

function CountLine({ value, text }: { value: number; text: (shown: number) => string }) {
  const shown = useCountUp(value);
  return <Text style={styles.value}>{text(shown)}</Text>;
}

export function WeekReportHost() {
  const id = useWeekReport((state) => state.id);
  const report = useWeekReport((state) => state.report);
  const clear = useWeekReport((state) => state.clear);

  useEffect(() => {
    if (!useWeekReport.getState().report) return;
    haptic.heavy();
    const timer = setTimeout(() => haptic.success(), 170);
    return () => clearTimeout(timer);
  }, [id]);

  return (
    <SheetFrame visible={report != null} onClose={clear} label={copy.close}>
      {report ? (
        <View style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.plan.weekDone}
          </Text>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.label}>{copy.you.lifts}</Text>
              <CountLine value={report.lifts} text={(shown) => `${Math.round(shown)}/${report.planned}`} />
            </View>
            <View style={styles.tile}>
              <Text style={styles.label}>{copy.plan.extraBurn}</Text>
              <CountLine value={report.burn} text={(shown) => Math.round(shown).toLocaleString("en-US")} />
            </View>
            <View style={styles.tile}>
              <Text style={styles.label}>{copy.you.weight}</Text>
              {report.weight == null ? (
                <Text style={styles.value}>–</Text>
              ) : (
                <CountLine value={report.weight} text={(shown) => formatWeight(shown, report.signed)} />
              )}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              clear();
              openPlan("week");
            }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{copy.plan.seeThisWeek}</Text>
          </Pressable>
        </View>
      ) : null}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: theme.orange.surface,
    borderRadius: 24,
    padding: 16,
    gap: 16,
  },
  title: { color: theme.text, fontFamily: theme.fonts.display, fontSize: 28, letterSpacing: 0.4, textTransform: "uppercase" },
  tiles: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 4,
  },
  label: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  value: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 18 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: theme.orange.selectedFill,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#ffffff", fontFamily: theme.fonts.bodySemi, fontSize: 15 },
});
