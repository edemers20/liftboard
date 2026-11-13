import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { Rise, SheetFrame, useCountUp } from "@/components/motion";
import { copy, fill } from "@/copy";
import { haptic } from "@/haptic";
import { Check, Share } from "@/icons";
import { openPlan } from "@/links";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { toDisplay } from "@/units";

const TRACK = "#34302c";
const SHORT = "#e7b94a";
const PILL = "#1f3029";
const PR_CARD = "#2a211c";
const LINE = "#2f2a27";
const INK = "#2a1a12";
const SECONDARY = "#2f2a27";

type Muscle = { name: string; done: number; planned: number };
type PR = { n: string; kind: "top" | "reps"; w: number; r: number; wasW: number | null; wasR: number | null };
type Up = { n: string; fromW: number; fromR: number; toW: number; toR: number };
type Activity = { k: string; n: number; min: number };

type Report = {
  start: number;
  lifts: number;
  planned: number;
  sets: number | null;
  muscles: Muscle[] | null;
  prs: PR[];
  ups: Up[];
  sport: number;
  burn: number;
  activities: Activity[];
  nextTitle: string;
  nextStart: number;
  completed: boolean;
  streak: number;
};

function rangeLabel(start: number) {
  const open = new Date(start);
  const close = new Date(start);
  close.setDate(close.getDate() + 6);
  const short = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (open.getMonth() === close.getMonth()) return `${short(open)} – ${close.getDate()}`;
  return `${short(open)} – ${short(close)}`;
}

function whenLabel(start: number) {
  return new Date(start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function setLine(name: string, weight: number, reps: number) {
  if (engine.isBW(name) && !(weight > 0)) return `${copy.history.bw} ${copy.history.times} ${reps}`;
  const shown = toDisplay(weight);
  const text = Number.isInteger(shown) ? String(shown) : String(shown);
  return `${text} ${copy.history.times} ${reps}`;
}

function activityLabel(id: string) {
  if (id === "zone2") return copy.activities.zone2;
  const names = copy.activityNames as Record<string, string>;
  return names[id] || id;
}

function shownMuscles(muscles: Muscle[]) {
  return muscles.map((row) => {
    const done = Math.round(row.done);
    const planned = Math.round(row.planned);
    const met = planned <= 0 || done >= planned;
    return { name: row.name, done, planned, met, short: met ? 0 : planned - done };
  });
}

function CountValue({
  target,
  color,
  unit,
  label,
}: {
  target: number | null;
  color: string;
  unit: string;
  label: string;
}) {
  const shown = useCountUp(target ?? 0);
  const final = target == null ? "–" : Math.round(target).toLocaleString("en-US");
  const text = target == null ? "–" : Math.round(shown).toLocaleString("en-US");
  return (
    <Text accessibilityLabel={`${label} ${final}${unit}`} style={[styles.value, { color }]}>
      {text}
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
    </Text>
  );
}

function ReportShare({ report }: { report: Report }) {
  const range = rangeLabel(report.start);
  return (
    <View style={styles.shareCard}>
      <Text style={styles.shareBrand}>{copy.workout.liftBoard}</Text>
      <Text style={styles.shareTitle}>{range}</Text>
      <Text style={styles.shareLine}>
        {report.completed ? copy.report.allDone(report.lifts, report.streak) : copy.history.liftsOf(report.lifts, report.planned)}
      </Text>
      <Text style={styles.shareStat}>
        {copy.you.lifts} {report.lifts}/{report.planned}
      </Text>
      <Text style={styles.shareStat}>
        {copy.history.sets} {report.sets == null ? "–" : report.sets}
      </Text>
      <Text style={styles.shareStat}>
        {copy.history.sport} {report.sport} {copy.you.min}
      </Text>
      <Text style={styles.shareStat}>
        {copy.plan.extraBurn} {report.burn.toLocaleString("en-US")} {copy.report.kcal}
      </Text>
      {report.ups.map((row) => (
        <Text key={row.n} style={styles.shareStat}>
          {row.n} {setLine(row.n, row.fromW, row.fromR)} → {setLine(row.n, row.toW, row.toR)}
        </Text>
      ))}
    </View>
  );
}

function ReportSheet({ report }: { report: Report }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useCountUp(1);
  const shot = useRef<any>(null);
  const [busy, setBusy] = useState(false);
  const muscles = report.muscles ? shownMuscles(report.muscles) : null;
  const gap = muscles?.reduce<{ name: string; short: number } | null>((best, row) => {
    if (row.short <= 0) return best;
    if (!best || row.short > best.short) return { name: row.name, short: row.short };
    return best;
  }, null);
  const range = rangeLabel(report.start);

  async function share() {
    if (!shot.current || busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(shot, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
    } catch {
      // The sheet stays up if capture or sharing is unavailable.
    } finally {
      setBusy(false);
    }
  }

  return (
    <View accessibilityLabel={copy.report.label} style={[styles.sheet, { width, height: height - Math.max(insets.top, 20) }]}>
      <View ref={shot} collapsable={false} style={styles.offscreen}>
        <ReportShare report={report} />
      </View>
      <View style={styles.handle} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.eyebrow}>{copy.plan.weekDone}</Text>
            {report.completed ? (
              <View style={styles.pill}>
                <Check size={12} color={theme.green.accent} />
                <Text style={styles.pillText}>{copy.workouts.completed}</Text>
              </View>
            ) : null}
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {range}
          </Text>
          <Text style={styles.summary}>
            {report.completed ? copy.report.allDone(report.lifts, report.streak) : copy.history.liftsOf(report.lifts, report.planned)}
          </Text>
        </View>

        <View style={styles.tiles}>
          <View style={styles.tileRow}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>{copy.you.lifts}</Text>
              <CountValue target={report.lifts} color={theme.green.accent} unit={` / ${report.planned}`} label={copy.you.lifts} />
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>{copy.history.sets}</Text>
              <CountValue target={report.sets} color={theme.text} unit="" label={copy.history.sets} />
            </View>
          </View>
          <View style={styles.tileRow}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>{copy.history.sport}</Text>
              <CountValue target={report.sport} color={theme.pink.accent} unit={` ${copy.you.min}`} label={copy.history.sport} />
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>{copy.plan.extraBurn}</Text>
              <CountValue target={report.burn} color={theme.fuel} unit={` ${copy.report.kcal}`} label={copy.plan.extraBurn} />
            </View>
          </View>
        </View>

        {report.ups.length ? (
          <Rise delay={150}>
            <View accessibilityLabel={copy.report.goingUp} style={styles.card}>
              <Text style={styles.cardTitle}>{copy.report.goingUp}</Text>
              {report.ups.map((row) => (
                <View key={row.n} style={styles.split}>
                  <Text style={styles.rowName}>{row.n}</Text>
                  <Text style={styles.from}>
                    {setLine(row.n, row.fromW, row.fromR)}{" "}
                    <Text style={styles.to}>→ {setLine(row.n, row.toW, row.toR)}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </Rise>
        ) : null}

        {report.prs.length ? (
          <Rise delay={220}>
            <View accessibilityLabel={copy.report.prs(report.prs.length)} style={styles.prCard}>
              <Text style={styles.prTitle}>{copy.report.prs(report.prs.length)}</Text>
              {report.prs.map((row) => (
                <View key={row.n} style={styles.split}>
                  <View style={styles.prName}>
                    <Text style={styles.rowName}>{row.n}</Text>
                    <Text style={styles.kind}>{row.kind === "top" ? copy.report.heaviest : copy.history.prReps}</Text>
                  </View>
                  <View style={styles.prValue}>
                    <Text style={styles.prNumber}>{setLine(row.n, row.w, row.r)}</Text>
                    {row.wasW != null && row.wasR != null ? (
                      <Text style={styles.kind}>{fill(copy.report.was, setLine(row.n, row.wasW, row.wasR))}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </Rise>
        ) : null}

        {muscles?.length ? (
          <Rise delay={290}>
            <View accessibilityLabel={copy.history.setsByMuscle} style={styles.card}>
              <View style={styles.split}>
                <Text style={styles.cardTitle}>{copy.history.setsByMuscle}</Text>
                <Text style={styles.kind}>{copy.report.doneTarget}</Text>
              </View>
              {muscles.map((row) => {
                const widthPct = row.planned <= 0 ? 100 : Math.min(100, (row.done / row.planned) * 100 * progress);
                const color = row.met ? theme.green.accent : SHORT;
                return (
                  <View key={row.name} style={styles.muscle}>
                    <Text style={styles.muscleName}>{row.name}</Text>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${widthPct}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.muscleCount, { color: row.met ? theme.text : SHORT }]}>
                      {row.done}/{row.planned}
                    </Text>
                  </View>
                );
              })}
              {gap ? <Text style={styles.gap}>{copy.report.under(gap.name, gap.short)}</Text> : null}
            </View>
          </Rise>
        ) : null}

        {report.activities.length ? (
          <Rise delay={360}>
            <View accessibilityLabel={copy.you.activities} style={styles.activityCard}>
              <Text style={styles.cardTitle}>{copy.you.activities}</Text>
              {report.activities.map((row) => (
                <View key={row.k} style={styles.split}>
                  <Text style={styles.rowName}>{copy.report.activity(activityLabel(row.k), row.n)}</Text>
                  <Text style={styles.minutes}>{copy.history.minutes(row.min)}</Text>
                </View>
              ))}
            </View>
          </Rise>
        ) : null}

        {report.nextStart ? (
          <Rise delay={430}>
            <View accessibilityLabel={copy.report.next} style={styles.nextCard}>
              <Text style={styles.kind}>{copy.report.next}</Text>
              <Text style={styles.nextLine}>
                {report.nextTitle ? (
                  <>
                    {copy.report.startsWith(whenLabel(report.nextStart))}
                    <Text style={styles.nextName}>{report.nextTitle}</Text>
                  </>
                ) : (
                  copy.report.starts(whenLabel(report.nextStart))
                )}
              </Text>
            </View>
          </Rise>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void share()} style={[styles.share, busy && styles.busy]}>
          <Share size={18} color={theme.text} />
          <Text style={styles.shareText}>{copy.workout.share}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            engine.dismissWeekReport();
            openPlan("week");
          }}
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>{copy.report.seeNext}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function WeekReportHost() {
  const version = useEngineStore((state) => state.version);
  const live = useMemo(() => engine.pendingWeekReport() as Report | null, [version]);
  const held = useRef<Report | null>(null);
  if (live) held.current = live;
  const report = live || held.current;

  useEffect(() => {
    if (!live) return;
    haptic.heavy();
  }, [live?.start]);

  return (
    <SheetFrame visible={live != null} onClose={() => engine.dismissWeekReport()} label={copy.close}>
      {report ? <ReportSheet report={report} /> : null}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: theme.orange.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#3a3431",
    alignSelf: "center",
    marginTop: 8,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 14 },
  header: { gap: 6 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { color: theme.muted, fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PILL,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: theme.green.accent, fontFamily: theme.fonts.bodySemi, fontSize: 12 },
  title: {
    color: theme.text,
    fontFamily: theme.fonts.display,
    fontSize: 40,
    lineHeight: 42,
    textTransform: "uppercase",
  },
  summary: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20 },
  tiles: { gap: 8 },
  tileRow: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    backgroundColor: theme.orange.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  tileLabel: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  value: { fontFamily: theme.fonts.monoMedium, fontSize: 28, lineHeight: 34 },
  unit: { color: theme.muted, fontFamily: theme.fonts.mono, fontSize: 14 },
  card: { backgroundColor: theme.orange.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  prCard: { backgroundColor: PR_CARD, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  activityCard: { backgroundColor: theme.pink.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  cardTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  prTitle: { color: theme.fuel, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  split: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  rowName: { flex: 1, color: theme.text, fontFamily: theme.fonts.body, fontSize: 14 },
  from: { color: theme.muted, fontFamily: theme.fonts.mono, fontSize: 13 },
  to: { color: theme.fuel, fontFamily: theme.fonts.mono, fontSize: 13 },
  prName: { flex: 1, gap: 2 },
  prValue: { alignItems: "flex-end", gap: 2 },
  kind: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  prNumber: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 17 },
  muscle: { flexDirection: "row", alignItems: "center", gap: 10 },
  muscleName: { width: 92, color: theme.text, fontFamily: theme.fonts.body, fontSize: 13 },
  track: { flex: 1, height: 8, borderRadius: 999, backgroundColor: TRACK, overflow: "hidden" },
  fill: { height: 8, borderRadius: 999 },
  muscleCount: { width: 52, textAlign: "right", fontFamily: theme.fonts.mono, fontSize: 13 },
  gap: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 2 },
  minutes: { color: theme.muted, fontFamily: theme.fonts.mono, fontSize: 14 },
  nextCard: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  nextLine: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 22 },
  nextName: { fontFamily: theme.fonts.bodySemi },
  footer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  share: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: SECONDARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  nextButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: theme.orange.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButtonText: { color: INK, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  busy: { opacity: 0.5 },
  offscreen: { position: "absolute", left: -4000, top: 0 },
  shareCard: { width: 1080, backgroundColor: theme.orange.background, padding: 72, gap: 16 },
  shareBrand: { color: theme.orange.accent, fontFamily: theme.fonts.display, fontSize: 44 },
  shareTitle: { color: theme.text, fontFamily: theme.fonts.display, fontSize: 88, textTransform: "uppercase" },
  shareLine: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 36 },
  shareStat: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 40 },
});
