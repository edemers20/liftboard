"use no memo";

import { LinearGradient } from "expo-linear-gradient";
import { Activity, Flame, Star } from "lucide-react-native";
import { StyleSheet, Text, View, type TextStyle } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

import { copy } from "@/copy";
import { trendPoints, weekRange } from "@/history-model";
import { TabWorkouts } from "@/icons";
import { engine } from "@/store";
import { theme } from "@/theme";
import { buildWeekImage, type WeekImageData } from "@/week-image-data";

/** 360pt wide; iOS captures at screen scale, so about 1080px on a 3x phone. */
export const WEEK_IMAGE_WIDTH = 360;
const PANEL = "rgba(24,21,19,0.9)";
const HALO = "#181513";
const EMPTY = "#34302c";
const GAP = 11;
const PAD = 8;
const INNER = WEEK_IMAGE_WIDTH - PAD * 2;
const PANEL_W = (INNER - GAP) / 2;
const SPARK_W = PANEL_W - 28;
const SPARK_H = Math.round((SPARK_W * 32) / 96);
const DOT = 35;
const RING = 6;

export function readWeekImage(report: { start: number; prs: unknown[]; streak: number }): WeekImageData {
  return buildWeekImage({
    start: report.start,
    sessions: (engine.wk.sessions || []) as { t?: number; k?: string }[],
    prTimes: (engine.recentPrs() as { t: number }[]).map((row) => row.t),
    prs: report.prs.length,
    streak: report.streak,
    strength: engine.strengthTrend(),
  });
}

/** Light text with a dark edge, so it reads on a photo of any brightness. */
function Outlined({ children, style, edge }: { children: string; style: TextStyle; edge: number }) {
  const offsets = Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2;
    const x = +(Math.cos(angle) * edge).toFixed(2);
    const y = +(Math.sin(angle) * edge).toFixed(2);
    return { left: x, right: -x, top: y, bottom: -y };
  });
  return (
    <View>
      {offsets.map((offset, index) => (
        <Text key={index} numberOfLines={1} style={[style, styles.halo, offset]}>
          {children}
        </Text>
      ))}
      <Text numberOfLines={1} style={style}>
        {children}
      </Text>
    </View>
  );
}

function Dot({ kind, pr }: { kind: "lift" | "activity" | null; pr?: boolean }) {
  return (
    <View style={styles.dotBox}>
      {pr ? <View style={styles.ring} /> : null}
      {kind === "lift" ? (
        <View style={[styles.dot, { backgroundColor: theme.green.accent }]}>
          <TabWorkouts size={23} color={theme.ink} strokeWidth={2.2} />
        </View>
      ) : kind === "activity" ? (
        <View style={[styles.dot, { backgroundColor: theme.pink.accent }]}>
          <Activity size={21} color={theme.ink} strokeWidth={2.2} />
        </View>
      ) : (
        <View style={[styles.dot, styles.empty]} />
      )}
    </View>
  );
}

function TrendSpark({ values }: { values: number[] }) {
  const { points, zero } = trendPoints(values);
  const last = points[points.length - 1];
  return (
    <Svg width={SPARK_W} height={SPARK_H} viewBox="0 0 96 32">
      <Line x1={4} x2={92} y1={zero} y2={zero} stroke={theme.orange.accent} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 3" />
      <Polyline
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke={theme.fuel}
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last ? <Circle cx={last.x} cy={last.y} r={3.8} fill={theme.fuel} /> : null}
    </Svg>
  );
}

/** Transparent background; everything that needs contrast sits on its own dark panel or has a dark edge. */
export function WeekImage({ data }: { data: WeekImageData }) {
  const letters = copy.history.dayLetters;
  const trends: { key: string; label: string; values: number[] }[] = [];
  if (data.upper) trends.push({ key: "upper", label: copy.history.trendUpper, values: data.upper });
  if (data.lower) trends.push({ key: "lower", label: copy.history.trendLower, values: data.lower });
  return (
    <View style={styles.card}>
      <Outlined style={styles.date} edge={4}>
        {weekRange(data.start)}
      </Outlined>
      <View style={styles.strip}>
        {data.days.map((day, index) => (
          <View key={index} style={styles.col}>
            <Text style={styles.letter}>{letters[day.weekday]}</Text>
            <Dot kind={day.lift ? "lift" : null} pr={day.pr} />
            <Dot kind={day.activity ? "activity" : null} />
          </View>
        ))}
      </View>
      <View style={styles.chips}>
        <View style={[styles.chip, { backgroundColor: theme.record }]}>
          <Star size={23} color={theme.ink} strokeWidth={2.2} />
          <Text style={styles.chipNumber}>{data.prs}</Text>
          <Text style={styles.chipText}>{data.prs === 1 ? copy.workout.sharePr : copy.workout.sharePrs}</Text>
        </View>
        {data.streak > 0 ? (
          <LinearGradient colors={[theme.pink.accent, theme.fuel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
            <Flame size={23} color={theme.ink} strokeWidth={2.2} />
            <Text style={styles.chipNumber}>{data.streak}</Text>
          </LinearGradient>
        ) : null}
      </View>
      {trends.length ? (
        <View style={styles.trends}>
          {trends.map((row) => (
            <View key={row.key} style={styles.panel}>
              <Text style={styles.trendLabel}>{row.label}</Text>
              <TrendSpark values={row.values} />
            </View>
          ))}
        </View>
      ) : null}
      <Outlined style={styles.brand} edge={2.6}>
        {copy.workout.liftBoard}
      </Outlined>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: WEEK_IMAGE_WIDTH, alignItems: "center", gap: 18, padding: PAD, backgroundColor: "transparent" },
  halo: { position: "absolute", color: HALO },
  date: { color: theme.text, fontFamily: theme.fonts.display, fontSize: 53, lineHeight: 58, textTransform: "uppercase" },
  strip: { flexDirection: "row", gap: 7, width: INNER },
  col: {
    flex: 1,
    alignItems: "center",
    gap: 9,
    paddingTop: 12,
    paddingBottom: 14,
    borderRadius: 999,
    backgroundColor: PANEL,
  },
  letter: { color: theme.muted, fontFamily: theme.fonts.bodySemi, fontSize: 18 },
  dotBox: { width: DOT, height: DOT, alignItems: "center", justifyContent: "center" },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: "center", justifyContent: "center" },
  empty: { backgroundColor: "transparent", borderWidth: 2.6, borderColor: EMPTY },
  ring: {
    position: "absolute",
    top: -RING,
    left: -RING,
    width: DOT + RING * 2,
    height: DOT + RING * 2,
    borderRadius: (DOT + RING * 2) / 2,
    borderWidth: 2.6,
    borderColor: theme.record,
    backgroundColor: HALO,
  },
  chips: { flexDirection: "row", gap: GAP },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 999,
    overflow: "hidden",
    paddingVertical: 9,
    paddingLeft: 14,
    paddingRight: 18,
  },
  chipNumber: { color: theme.ink, fontFamily: theme.fonts.monoMedium, fontSize: 26 },
  chipText: { color: theme.ink, fontFamily: theme.fonts.bodySemi, fontSize: 21 },
  trends: { flexDirection: "row", gap: GAP, width: INNER, justifyContent: "center" },
  panel: { width: PANEL_W, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 7, borderRadius: 25, backgroundColor: PANEL },
  trendLabel: { color: theme.muted, fontFamily: theme.fonts.bodySemi, fontSize: 18, letterSpacing: 0.7 },
  brand: { color: theme.green.accent, fontFamily: theme.fonts.display, fontSize: 23, lineHeight: 28 },
});
