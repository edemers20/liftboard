"use no memo";

import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { Copy as CopyIcon } from "lucide-react-native";
import { PressableScale } from "@/components/pressable-scale";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { router, usePathname } from "expo-router";
import { afterLaunchSplash } from "@/components/launch-splash";
import { Rise, useCountUp } from "@/components/motion";
import { openReportSheet } from "@/form-sheet";
import { copy, fill } from "@/copy";
import { haptic } from "@/haptic";
import { Check, Share } from "@/icons";
import { openPlan } from "@/links";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { toDisplay } from "@/units";
import { readWeekImage, WeekImage } from "@/week-image";

const TRACK = "#34302c";
const SHORT = "#e7b94a";
const PILL = "#1f3029";
const LINE = "#2f2a27";
const INK = theme.ink;
const SECONDARY = "#2f2a27";
/** Week card tiles, on screen and in the shared image: the accent is the tile, the text is dark. */
const TILE_LIFTS = theme.green.accent;
const TILE_ACTIVITY = theme.pink.accent;
const TILE_KCAL = theme.fuel;
const TILE_PRS = theme.record;

type Muscle = { name: string; done: number; planned: number };
type PR = { n: string; kind: "top" | "reps"; w: number; r: number; wasW: number | null; wasR: number | null };
type Up = { n: string; fromW: number; fromR: number; toW: number; toR: number };
type Activity = { k: string; n: number; min: number };

export type Report = {
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
    return { name: row.name, done, planned, met: planned <= 0 || done >= planned };
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
  const unitStyle = [styles.unit, { color }];
  const shown = useCountUp(target ?? 0);
  const final = target == null ? "–" : Math.round(target).toLocaleString("en-US");
  const text = target == null ? "–" : Math.round(shown).toLocaleString("en-US");
  return (
      <Text accessibilityLabel={`${label} ${final}${unit}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.value, { color }]}>
      {text}
      {unit ? <Text style={unitStyle}>{unit}</Text> : null}
    </Text>
  );
}

/** The shared image, in the workout share card's style. 1080 wide; the height follows the content. */
function ReportShare({ report }: { report: Report }) {
  const tiles = [
    { label: copy.you.lifts, value: String(report.lifts), unit: ` / ${report.planned}`, color: TILE_LIFTS },
    { label: copy.workout.sharePrs, value: String(report.prs.length), unit: "", color: TILE_PRS },
    { label: copy.report.activityTile, value: report.sport.toLocaleString("en-US"), unit: ` ${copy.you.min}`, color: TILE_ACTIVITY },
    { label: copy.report.exerciseCalories, value: report.burn.toLocaleString("en-US"), unit: ` ${copy.report.kcal}`, color: TILE_KCAL },
  ];
  return (
    <View style={styles.shareCard}>
      <Text style={styles.shareBrand}>{copy.workout.liftBoard}</Text>
      <Text style={styles.shareTitle}>{rangeLabel(report.start)}</Text>
      <View style={styles.shareTiles}>
        {tiles.map((tile) => (
          <View key={tile.label} style={[styles.shareTile, { backgroundColor: tile.color }]}>
            <Text style={styles.shareTileLabel}>{tile.label}</Text>
            <Text style={styles.shareTileValue}>
              {tile.value}
              {tile.unit ? <Text style={styles.shareTileUnit}>{tile.unit}</Text> : null}
            </Text>
          </View>
        ))}
      </View>
      {report.prs.length ? (
        <View style={[styles.shareSection, styles.sharePrs]}>
          <Text style={[styles.shareSectionTitle, styles.sharePrsTitle]}>{copy.report.records}</Text>
          {report.prs.map((row) => (
            <View key={row.n} style={styles.shareRow}>
              <Text numberOfLines={1} style={styles.shareRowName}>{row.n}</Text>
              <Text style={styles.shareRowValue}>{setLine(row.n, row.w, row.r)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {report.ups.length ? (
        <View style={styles.shareSection}>
          <Text style={styles.shareSectionTitle}>{copy.report.goingUp}</Text>
          {report.ups.map((row) => (
            <View key={row.n} style={styles.shareRow}>
              <Text numberOfLines={1} style={styles.shareRowName}>{row.n}</Text>
              <Text style={[styles.shareRowValue, styles.shareUp]}>{setLine(row.n, row.toW, row.toR)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ReportSheet({ report }: { report: Report }) {
  const { width: windowW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useCountUp(1);
  const shot = useRef<any>(null);
  const clearShot = useRef<any>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const muscles = report.muscles ? shownMuscles(report.muscles) : null;
  const range = rangeLabel(report.start);
  const width = windowW > 0 ? windowW : 390;
  const tileW = Math.floor((width - 32 - 8) / 2);
  const bottom = Math.max(insets.bottom, 16);
  const [barH, setBarH] = useState(10 + 52 + bottom);
  const [boxH, setBoxH] = useState(0);
  // Grabber overlaps the top. The button bar sits on the bottom of the sheet, so the
  // scroll content keeps a pad at least that tall, including the home-indicator inset.
  const footerH = Math.max(barH, 10 + 52 + bottom);
  const scrollH = boxH > footerH ? boxH - footerH : 0;

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

  async function copyImage() {
    if (!clearShot.current || busy) return;
    setBusy(true);
    try {
      const base64 = await captureRef(clearShot, { format: "png", quality: 1, result: "base64" });
      await Clipboard.setImageAsync(base64);
      haptic.success();
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Nothing is copied if capture or the clipboard is unavailable.
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  const summary = (
    <>
      <View style={[styles.headerRow, { width: width - 32 }]}>
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.title, { maxWidth: width - 32 - 128 }]}>
          {range}
        </Text>
        <View style={[styles.pill, !report.completed && styles.pillOpen]}>
          {report.completed ? <Check size={12} color={theme.green.accent} /> : null}
          <Text style={[styles.pillText, !report.completed && styles.pillTextOpen]}>
            {report.completed ? copy.workouts.completed : copy.history.liftsOf(report.lifts, report.planned)}
          </Text>
        </View>
      </View>

      <View style={styles.tiles}>
        <View style={styles.tileRow}>
          <View style={[styles.tile, { width: tileW, backgroundColor: TILE_LIFTS }]}>
            <Text style={styles.tileLabel}>{copy.you.lifts}</Text>
            <CountValue target={report.lifts} color={INK} unit={` / ${report.planned}`} label={copy.you.lifts} />
          </View>
          <View style={[styles.tile, { width: tileW, backgroundColor: TILE_PRS }]}>
            <Text style={styles.tileLabel}>{copy.workout.sharePrs}</Text>
            <CountValue target={report.prs.length} color={INK} unit="" label={copy.workout.sharePrs} />
          </View>
        </View>
        <View style={styles.tileRow}>
          <View style={[styles.tile, { width: tileW, backgroundColor: TILE_ACTIVITY }]}>
            <Text style={styles.tileLabel}>{copy.report.activityTile}</Text>
            <CountValue target={report.sport} color={INK} unit={` ${copy.you.min}`} label={copy.report.activityTile} />
          </View>
          <View style={[styles.tile, { width: tileW, backgroundColor: TILE_KCAL }]}>
            <Text style={styles.tileLabel}>{copy.report.exerciseCalories}</Text>
            <CountValue target={report.burn} color={INK} unit={` ${copy.report.kcal}`} label={copy.report.exerciseCalories} />
          </View>
        </View>
      </View>
    </>
  );

  const more = (
    <>

        {report.ups.length ? (
          <Rise delay={150}>
            <View accessibilityLabel={copy.report.goingUp} style={styles.card}>
              <Text style={styles.cardTitle}>{copy.report.goingUp}</Text>
              {report.ups.map((row) => (
                <View key={row.n} style={styles.split}>
                  <Text numberOfLines={2} style={styles.rowName}>{row.n}</Text>
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
            <View accessibilityLabel={copy.report.records} style={styles.prCard}>
              <Text style={styles.prTitle}>{copy.report.records}</Text>
              {report.prs.map((row) => (
                <View key={row.n} style={styles.split}>
                  <View style={styles.prName}>
                    <Text numberOfLines={2} style={styles.rowName}>{row.n}</Text>
                    <Text style={styles.prKind}>{row.kind === "top" ? copy.history.prTop : copy.history.prReps}</Text>
                  </View>
                  <View style={styles.prValue}>
                    <Text style={styles.prNumber}>{setLine(row.n, row.w, row.r)}</Text>
                    {row.wasW != null && row.wasR != null ? (
                      <Text style={styles.prKind}>{fill(copy.report.was, setLine(row.n, row.wasW, row.wasR))}</Text>
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
              <Text style={styles.cardTitle}>{copy.history.setsByMuscle}</Text>
              {muscles.map((row) => {
                const widthPct = row.planned <= 0 ? 100 : Math.min(100, (row.done / row.planned) * 100 * progress);
                const color = row.met ? theme.green.accent : SHORT;
                return (
                  <View key={row.name} style={styles.muscle}>
                    <Text numberOfLines={1} style={styles.muscleName}>{row.name}</Text>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${widthPct}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.muscleCount, { color: row.met ? theme.text : SHORT }]}>
                      {row.done}/{row.planned}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Rise>
        ) : null}

        {report.activities.length ? (
          <Rise delay={360}>
            <View accessibilityLabel={copy.you.activities} style={styles.activityCard}>
              <Text style={styles.cardTitle}>{copy.you.activities}</Text>
              {report.activities.map((row) => (
                <View key={row.k} style={styles.split}>
                  <Text numberOfLines={2} style={styles.rowName}>{copy.report.activity(activityLabel(row.k), row.n)}</Text>
                  <Text style={styles.minutes}>{copy.history.minutes(row.min)}</Text>
                </View>
              ))}
            </View>
          </Rise>
        ) : null}
    </>
  );

  return (
    <View
      accessibilityLabel={copy.report.label}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.height;
        setBoxH((prev) => (Math.abs(prev - next) < 1 ? prev : next));
      }}
      style={[styles.sheet, { flex: 1, width }]}
    >
      <ScrollView
        style={scrollH > 0 ? { width, height: scrollH } : styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: footerH }]}
        showsVerticalScrollIndicator={false}
      >
        {summary}
        {more}
      </ScrollView>
      <View
        onLayout={(event) => {
          const next = event.nativeEvent.layout.height;
          setBarH((prev) => (Math.abs(prev - next) < 1 ? prev : next));
        }}
        style={[styles.footer, { width, paddingBottom: bottom }]}
      >
        <PressableScale accessibilityRole="button" disabled={busy} onPress={() => void share()} style={[styles.share, busy && styles.busy]}>
          <Share size={18} color={theme.text} />
          <Text style={styles.shareText}>{copy.workout.share}</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={copied ? copy.report.imageCopied : copy.report.copyImage}
          disabled={busy}
          onPress={() => void copyImage()}
          style={[styles.share, busy && styles.busy]}
        >
          {copied ? <Check size={18} color={theme.green.accent} /> : <CopyIcon size={18} color={theme.text} strokeWidth={2} />}
          <Text style={styles.shareText}>{copy.report.copyImage}</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          onPress={() => {
            engine.dismissWeekReport();
            router.back();
            openPlan("week");
          }}
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>{copy.report.seeNext}</Text>
        </PressableScale>
      </View>
      <View ref={shot} collapsable={false} pointerEvents="none" style={styles.offscreen}>
        <ReportShare report={report} />
      </View>
      <View ref={clearShot} collapsable={false} pointerEvents="none" style={styles.offscreen}>
        <WeekImage data={readWeekImage(report)} />
      </View>
    </View>
  );
}

let reportOpened: number | null = null;
let remembered: Report | null = null;

/** The report handed to the sheet at open, so the route still has it if the pending flag is already clear. */
export function rememberedWeekReport(): Report | null {
  return remembered;
}

export function WeekReportHost() {
  const path = usePathname();
  const pending = useEngineStore(() => `${engine.wk.reportPending ?? ""}:${engine.wk.setupDone ? 1 : 0}`);
  const live = useMemo(() => engine.pendingWeekReport() as Report | null, [pending]);

  useEffect(() => {
    if (!live) {
      reportOpened = null;
      return;
    }
    if (reportOpened === live.start || path === "/sheet-report") return;
    afterLaunchSplash(() => {
      requestAnimationFrame(() => {
        if (!engine.wk.setupDone) return;
        const current = engine.pendingWeekReport() as Report | null;
        if (!current || reportOpened === current.start) return;
        reportOpened = current.start;
        remembered = current;
        haptic.heavy();
        openReportSheet();
      });
    });
  }, [live, path]);

  return null;
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "transparent",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 28, gap: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  pill: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PILL,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillOpen: { backgroundColor: LINE },
  pillText: { color: theme.green.accent, fontFamily: theme.fonts.bodySemi, fontSize: 12 },
  pillTextOpen: { color: theme.muted },
  title: {
    flexShrink: 1,
    color: theme.text,
    fontFamily: theme.fonts.display,
    fontSize: 40,
    lineHeight: 48,
    textTransform: "uppercase",
  },
  tiles: { gap: 8 },
  tileRow: { flexDirection: "row", gap: 8 },
  tile: {
    backgroundColor: theme.orange.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  tileLabel: { color: INK, opacity: 0.75, fontFamily: theme.fonts.body, fontSize: 12 },
  value: { fontFamily: theme.fonts.monoMedium, fontSize: 28, lineHeight: 34, flexShrink: 1 },
  unit: { opacity: 0.7, fontFamily: theme.fonts.mono, fontSize: 14 },
  card: { backgroundColor: theme.orange.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  prCard: { backgroundColor: theme.orange.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  activityCard: { backgroundColor: theme.pink.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  cardTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  prTitle: { color: theme.record, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  split: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  rowName: { flex: 1, minWidth: 0, color: theme.text, fontFamily: theme.fonts.body, fontSize: 14 },
  from: { flexShrink: 1, color: theme.muted, fontFamily: theme.fonts.mono, fontSize: 13, textAlign: "right" },
  to: { color: theme.fuel, fontFamily: theme.fonts.mono, fontSize: 13 },
  prName: { flex: 1, gap: 2 },
  prValue: { alignItems: "flex-end", gap: 2 },
  prKind: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  prNumber: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 17 },
  muscle: { flexDirection: "row", alignItems: "center", gap: 10 },
  muscleName: { width: 96, flexShrink: 0, color: theme.text, fontFamily: theme.fonts.body, fontSize: 13 },
  track: { flex: 1, height: 8, borderRadius: 999, backgroundColor: TRACK, overflow: "hidden" },
  fill: { height: 8, borderRadius: 999 },
  muscleCount: { minWidth: 52, flexShrink: 0, textAlign: "right", fontFamily: theme.fonts.mono, fontSize: 13 },
  minutes: { color: theme.muted, fontFamily: theme.fonts.mono, fontSize: 14 },
  footer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LINE,
    backgroundColor: theme.orange.background,
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
  shareCard: { width: 1080, backgroundColor: theme.orange.background, padding: 72, paddingBottom: 80, gap: 36 },
  shareBrand: { color: theme.green.accent, fontFamily: theme.fonts.display, fontSize: 44 },
  shareTitle: { color: theme.text, fontFamily: theme.fonts.display, fontSize: 104, lineHeight: 108, textTransform: "uppercase" },
  shareTiles: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  shareTile: { width: (1080 - 72 * 2 - 24) / 2, borderRadius: 28, paddingHorizontal: 32, paddingVertical: 28, gap: 8 },
  shareTileLabel: { color: INK, opacity: 0.75, fontFamily: theme.fonts.bodySemi, fontSize: 28 },
  shareTileValue: { color: INK, fontFamily: theme.fonts.monoMedium, fontSize: 72 },
  shareTileUnit: { fontFamily: theme.fonts.mono, fontSize: 32 },
  shareSection: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 28, paddingHorizontal: 36, paddingVertical: 32, gap: 20 },
  shareSectionTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 34 },
  shareRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 24 },
  shareRowName: { flex: 1, color: theme.text, fontFamily: theme.fonts.bodyMedium, fontSize: 34 },
  shareRowValue: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 36 },
  shareUp: { color: theme.fuel },
  sharePrs: { backgroundColor: theme.purple.tint },
  sharePrsTitle: { color: theme.record },
});
