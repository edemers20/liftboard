import { router } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
  type ViewInstance,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { copy } from "@/copy";
import { openPlan } from "@/links";
import type { HistoryDay, HistorySession, HistorySnapshot, LiftTrend, PastWeek, SessionExercise } from "@/history-data";
import {
  displayWeight,
  formatHours,
  formatWeight,
  MIX_ORDER,
  monthGrid,
  sparkPoints,
  type MixKind,
  type MonthCell,
  type MixWeek,
} from "@/history-model";
import { storage } from "@/storage";
import { theme } from "@/theme";
import { nativeDriver, useReduceMotion } from "@/use-reduce-motion";

const VIEW_KEY = "liftboard.v1.hv";
const VIEWS = ["cal", "weeks", "lifts"] as const;
type ViewId = (typeof VIEWS)[number];

const LINE = "#393330";
const LIFT_FILL = "#2f5a4c";
const LIFT_INK = "#e6fff6";
const ACT_FILL = "#5a3447";
const ACT_INK = "#ffe6f0";
const CLASSES = "#b9a3f0";
const NEGATIVE = "#ec8b68";
const TODAY = "#6fd0b4";
const BAR_MAX = 112;

const KIND_COLOR: Record<MixKind, string> = {
  lift: theme.green.accent,
  sport: theme.pink.accent,
  cls: CLASSES,
  cardio: theme.fuel,
};

const SPLIT_FILL = {
  experimental_backgroundImage: "linear-gradient(135deg, #2f5a4c 50%, #5a3447 50%)",
  ...(Platform.OS === "web"
    ? { backgroundImage: "linear-gradient(135deg, #2f5a4c 50%, #5a3447 50%)" }
    : null),
} as ViewStyle;

type InfoId = "mix" | "weeks" | "lifts";

const INFO: Record<InfoId, { title: string; body: string }> = {
  mix: { title: copy.history.weekMix, body: copy.history.weekMixInfo },
  weeks: { title: copy.history.previousWeeks, body: copy.history.previousWeeksInfo },
  lifts: { title: copy.history.mainLifts, body: copy.history.mainLiftsInfo },
};

function storedView(): ViewId {
  const saved = storage.getItem(VIEW_KEY);
  return saved === "weeks" || saved === "lifts" || saved === "cal" ? saved : "cal";
}

function viewLabel(id: ViewId): string {
  if (id === "weeks") return copy.history.weeks;
  if (id === "lifts") return copy.history.lifts;
  return copy.history.calendar;
}

function kindLabel(kind: MixKind): string {
  if (kind === "lift") return copy.history.lifting;
  if (kind === "sport") return copy.history.sport;
  if (kind === "cls") return copy.history.classes;
  return copy.history.cardio;
}

function unitWord(units: string): string {
  return units === "kg" ? copy.history.kg : copy.history.lb;
}

function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function shortDate(time: number): string {
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function axisDate(time: number): string {
  return new Date(time).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

function longDate(time: number): string {
  return new Date(time).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function detailDate(time: number): string {
  return new Date(time).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function uniqueShorts(sessions: HistorySession[]): string {
  const names: string[] = [];
  sessions.forEach((session) => {
    if (!names.includes(session.short)) names.push(session.short);
  });
  return names.join(" + ");
}

function setText(exercise: SessionExercise, units: string): string {
  if (exercise.cardio) return exercise.minutes ? copy.history.minutes(exercise.minutes) : copy.history.done;
  const shown = formatWeight(displayWeight(exercise.weight, units));
  const weight = exercise.bodyweight
    ? exercise.weight > 0
      ? copy.history.bwPlus(shown)
      : copy.history.bw
    : shown;
  return `${weight} ${copy.history.times} ${exercise.reps}`;
}

function deltaText(delta: number): string {
  const amount = formatWeight(Math.abs(delta));
  if (delta > 0) return `+${amount}`;
  if (delta < 0) return `−${amount}`;
  return `±${amount}`;
}

function mixSummary(weeks: MixWeek[]): string {
  return weeks
    .map((week) => {
      const parts = MIX_ORDER.filter((kind) => week.minutes[kind] > 0).map((kind) =>
        copy.history.kindMinutes(kindLabel(kind), String(Math.round(week.minutes[kind]))),
      );
      return copy.history.weekOfSummary(shortDate(week.start), parts.join(", ") || copy.history.nothingLogged);
    })
    .join(". ");
}

function weekRows(cells: MonthCell[]): MonthCell[][] {
  const rows: MonthCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    const row = cells.slice(index, index + 7);
    while (row.length < 7) row.push(null);
    rows.push(row);
  }
  return rows;
}

export function HistoryTab({ data }: { data: HistorySnapshot }) {
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<ViewId>(storedView);
  const [info, setInfo] = useState<InfoId | null>(null);
  const [infoTop, setInfoTop] = useState(120);
  const index = VIEWS.indexOf(view);
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const previous = useRef(index);

  useLayoutEffect(() => {
    const to = -index * width;
    const changed = previous.current !== index;
    previous.current = index;
    slide.stopAnimation();
    fade.stopAnimation();
    if (!changed) {
      slide.setValue(to);
      fade.setValue(1);
      return;
    }
    if (reduce) {
      Animated.timing(fade, { toValue: 0, duration: 70, useNativeDriver: nativeDriver }).start(({ finished }) => {
        if (!finished) return;
        slide.setValue(to);
        Animated.timing(fade, { toValue: 1, duration: 90, useNativeDriver: nativeDriver }).start();
      });
      return;
    }
    fade.setValue(1);
    Animated.timing(slide, {
      toValue: to,
      duration: 320,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: nativeDriver,
    }).start();
  }, [fade, index, reduce, slide, width]);

  function choose(next: ViewId) {
    if (next === view) return;
    setInfo(null);
    setView(next);
    storage.setItem(VIEW_KEY, next);
  }

  function toggleInfo(id: InfoId, node: ViewInstance | null) {
    if (info === id) {
      setInfo(null);
      return;
    }
    node?.measureInWindow((_x, y, _width, height) => {
      setInfoTop(y + height + 8);
      setInfo(id);
    });
  }

  const open = info ? INFO[info] : null;

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.tabs.history}
        </Text>
        <View accessibilityRole="tablist" accessibilityLabel={copy.tabs.history} style={styles.switch}>
          {VIEWS.map((id) => {
            const selected = id === view;
            return (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={viewLabel(id)}
                hitSlop={{ top: 2, bottom: 2 }}
                onPress={() => choose(id)}
                style={[styles.segment, selected && styles.segmentOn]}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>{viewLabel(id)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.pager}>
        <Animated.View style={[styles.track, { width: width * 3, transform: [{ translateX: slide }], opacity: fade }]}>
          <View
            style={{ width, height: "100%" }}
            accessibilityElementsHidden={view !== "cal"}
            importantForAccessibility={view === "cal" ? "auto" : "no-hide-descendants"}
            pointerEvents={view === "cal" ? "auto" : "none"}
          >
            <CalendarPage data={data} infoOpen={info === "mix"} onInfo={(node) => toggleInfo("mix", node)} />
          </View>
          <View
            style={{ width, height: "100%" }}
            accessibilityElementsHidden={view !== "weeks"}
            importantForAccessibility={view === "weeks" ? "auto" : "no-hide-descendants"}
            pointerEvents={view === "weeks" ? "auto" : "none"}
          >
            <WeeksPage data={data} infoOpen={info === "weeks"} onInfo={(node) => toggleInfo("weeks", node)} />
          </View>
          <View
            style={{ width, height: "100%" }}
            accessibilityElementsHidden={view !== "lifts"}
            importantForAccessibility={view === "lifts" ? "auto" : "no-hide-descendants"}
            pointerEvents={view === "lifts" ? "auto" : "none"}
          >
            <LiftsPage data={data} infoOpen={info === "lifts"} onInfo={(node) => toggleInfo("lifts", node)} />
          </View>
        </Animated.View>
      </View>
      <Modal transparent visible={open !== null} animationType="fade" onRequestClose={() => setInfo(null)}>
        <Pressable accessibilityRole="button" style={styles.backdrop} onPress={() => setInfo(null)}>
          <Pressable style={[styles.popover, { top: infoTop }]} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.popoverTitle}>{open?.title}</Text>
            <Text style={styles.popoverBody}>{open?.body}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SectionHeading({
  title,
  open,
  onInfo,
}: {
  title: string;
  open: boolean;
  onInfo: (node: ViewInstance | null) => void;
}) {
  const ref = useRef<ViewInstance>(null);
  return (
    <View ref={ref} style={styles.heading} collapsable={false}>
      <Text accessibilityRole="header" style={styles.eyebrow}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.history.whatThisDoes}
        accessibilityState={{ expanded: open }}
        hitSlop={13}
        onPress={() => onInfo(ref.current)}
      >
        <View style={[styles.infoDot, open && styles.infoDotOpen]}>
          <Text style={[styles.infoGlyph, open && styles.infoGlyphOpen]}>i</Text>
        </View>
      </Pressable>
    </View>
  );
}

function CalendarPage({
  data,
  infoOpen,
  onInfo,
}: {
  data: HistorySnapshot;
  infoOpen: boolean;
  onInfo: (node: ViewInstance | null) => void;
}) {
  const reduce = useReduceMotion();
  const now = new Date();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const shown = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const grid = monthGrid(year, month);
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const day = selected ? data.days[selected] : undefined;

  useEffect(() => {
    if (!selected || !day) return;
    const timer = setTimeout(() => scroll.current?.scrollToEnd({ animated: !reduce }), 40);
    return () => clearTimeout(timer);
  }, [day, reduce, selected]);

  function shift(by: number) {
    setOffset((current) => Math.min(0, current + by));
    setSelected(null);
  }

  return (
    <ScrollView ref={scroll} contentContainerStyle={styles.page}>
      {data.mix ? <WeekMix data={data} open={infoOpen} onInfo={onInfo} /> : null}
      <View style={styles.panel}>
        <View style={styles.monthBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.history.previousMonth}
            onPress={() => shift(-1)}
            style={styles.monthButton}
          >
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.monthTitle}>
            {monthTitle(year, month)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.history.nextMonth}
            accessibilityState={{ disabled: offset >= 0 }}
            disabled={offset >= 0}
            onPress={() => shift(1)}
            style={[styles.monthButton, offset >= 0 && styles.monthButtonOff]}
          >
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
        <View style={styles.weekdays}>
          {copy.history.dayLetters.split("").map((letter, index) => (
            <Text key={`${letter}-${index}`} style={styles.weekday}>
              {letter}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {weekRows(grid.cells).map((row, rowIndex) => (
            <View key={rowIndex} style={styles.gridRow}>
              {row.map((cell, column) => (
                <DayCell
                  key={cell?.key ?? `pad-${rowIndex}-${column}`}
                  cell={cell}
                  day={cell ? data.days[cell.key] : undefined}
                  today={cell?.key === todayKey}
                  selected={cell?.key === selected}
                  onPress={() => {
                    if (!cell) return;
                    setSelected((current) => (current === cell.key ? null : cell.key));
                  }}
                />
              ))}
            </View>
          ))}
        </View>
        {day && selected ? (
          <DayDetail
            day={day}
            units={data.units}
            label={detailDate(day.sessions[0]?.t ?? Date.now())}
            spoken={longDate(day.sessions[0]?.t ?? Date.now())}
          />
        ) : null}
        {data.hasSessions ? null : <Text style={styles.note}>{copy.history.sessionsShow}</Text>}
      </View>
    </ScrollView>
  );
}

function DayCell({
  cell,
  day,
  today,
  selected,
  onPress,
}: {
  cell: MonthCell;
  day: HistoryDay | undefined;
  today: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  if (!cell) return <View style={styles.cell} />;
  const ring = selected ? theme.text : today ? TODAY : undefined;
  const ringStyle = ring ? ({ boxShadow: `inset 0 0 0 2px ${ring}` } as ViewStyle) : null;
  const logged = !!day;
  const ink = !logged ? styles.dayMuted : day.kind === "lift" ? styles.dayLift : day.kind === "act" ? styles.dayAct : styles.dayBoth;
  const fill = !logged ? styles.cellEmpty : day.kind === "lift" ? styles.cellLift : day.kind === "act" ? styles.cellAct : null;
  const body = (
    <>
      {day?.kind === "both" ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, SPLIT_FILL]} /> : null}
      <Text style={[styles.dayNumber, logged && styles.dayNumberOn, ink]}>{cell.day}</Text>
    </>
  );
  if (!logged) return <View style={[styles.cell, fill, ringStyle]}>{body}</View>;
  const names = day.sessions.map((session) => session.name).join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${longDate(day.sessions[0]?.t ?? Date.now())}: ${names}`}
      onPress={onPress}
      style={[styles.cell, fill, ringStyle]}
    >
      {body}
    </Pressable>
  );
}

function openSession(session: HistorySession) {
  if (session.openActivity) {
    router.push({ pathname: "/activity/[t]", params: { t: String(session.openActivity) } });
  }
}

function DayDetail({ day, units, label, spoken }: { day: HistoryDay; units: string; label: string; spoken: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailDate}>{label}</Text>
      <Text accessibilityRole="header" accessibilityLabel={spoken} style={styles.detailTitle}>
        {uniqueShorts(day.sessions)}
      </Text>
      {day.sessions.map((session, index) => {
        const open = session.openActivity != null;
        const body = (
          <>
            {day.sessions.length > 1 || session.minutes > 0 ? (
              <View style={styles.sessionLine}>
                <View style={[styles.dot, session.lift ? styles.dotLift : styles.dotAct]} />
                <Text style={styles.sessionText}>
                  {session.name}
                  {session.minutes > 0 ? ` ${copy.history.minutesDot(session.minutes)}` : ""}
                </Text>
              </View>
            ) : null}
            {session.lift ? <ExerciseList exercises={session.exercises} units={units} /> : null}
          </>
        );
        if (!open) return <View key={`${session.t}-${index}`} style={styles.session}>{body}</View>;
        return (
          <Pressable
            key={`${session.t}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={session.name}
            onPress={() => openSession(session)}
            style={({ pressed }) => [styles.session, pressed && styles.sessionPressed]}
          >
            {body}
          </Pressable>
        );
      })}
    </View>
  );
}

function ExerciseList({ exercises, units }: { exercises: SessionExercise[]; units: string }) {
  if (!exercises.length) return <Text style={styles.note}>{copy.history.noSets}</Text>;
  return (
    <View style={styles.exercises}>
      {exercises.map((exercise, index) => (
        <View key={`${exercise.name}-${index}`} style={styles.exercise}>
          <Text style={styles.exerciseName}>
            {exercise.name}
            {exercise.extra ? <Text style={styles.added}> {copy.history.added}</Text> : null}
          </Text>
          <Text style={styles.exerciseValue}>{setText(exercise, units)}</Text>
        </View>
      ))}
    </View>
  );
}

function WeekMix({
  data,
  open,
  onInfo,
}: {
  data: HistorySnapshot;
  open: boolean;
  onInfo: (node: ViewInstance | null) => void;
}) {
  const mix = data.mix;
  if (!mix) return null;
  const used = MIX_ORDER.filter((kind) => mix.weeks.some((week) => week.minutes[kind] > 0));
  const average = mix.averageMinutes ? copy.history.aboutAWeek(formatHours(mix.averageMinutes)) : "";
  return (
    <View style={styles.panel}>
      <SectionHeading title={copy.history.weekMix} open={open} onInfo={onInfo} />
      <Text style={styles.note}>
        {copy.history.hoursByKind}
        {average}
      </Text>
      <View accessibilityRole="image" accessibilityLabel={mixSummary(mix.weeks)} style={styles.mix}>
        {mix.weeks.map((week) => (
          <View key={week.start} style={styles.mixCol}>
            <Text style={styles.mixHours}>{week.total ? formatHours(week.total) : ""}</Text>
            <View style={[styles.mixBar, { height: (week.total / mix.max) * BAR_MAX }, week.current && styles.mixNow]}>
              {MIX_ORDER.map((kind) =>
                week.minutes[kind] > 0 ? (
                  <View key={kind} style={{ flex: week.minutes[kind], backgroundColor: KIND_COLOR[kind], minHeight: 2 }} />
                ) : null,
              )}
            </View>
            <Text style={[styles.mixLabel, week.current && styles.mixLabelNow]}>
              {week.current ? copy.history.now : axisDate(week.start)}
            </Text>
          </View>
        ))}
      </View>
      {used.length ? (
        <View style={styles.legend}>
          {used.map((kind) => (
            <View key={kind} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: KIND_COLOR[kind] }]} />
              <Text style={styles.legendText}>{kindLabel(kind)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function WeeksPage({
  data,
  infoOpen,
  onInfo,
}: {
  data: HistorySnapshot;
  infoOpen: boolean;
  onInfo: (node: ViewInstance | null) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.panel}>
        <SectionHeading title={copy.history.previousWeeks} open={infoOpen} onInfo={onInfo} />
        {data.weeks.length ? (
          data.weeks.map((week, index) => <WeekCard key={week.start} week={week} first={index === 0} units={data.units} />)
        ) : (
          <Pressable accessibilityRole="button" onPress={() => openPlan("week")}>
            <Text style={styles.note}>{copy.history.savesWhen}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function WeekCard({ week, first, units }: { week: PastWeek; first: boolean; units: string }) {
  const missed = week.lifts < week.planned;
  const season = week.season === "In-season" ? copy.history.inSeason : copy.history.offSeason;
  let line = season;
  if (week.ramp) line += ` ${copy.history.ramp}`;
  if (week.deload) line += ` ${copy.history.deload}`;
  line += ` · ${week.goal}`;
  if (week.focus) line += ` ${copy.history.focusLine(week.focus.toLowerCase())}`;
  return (
    <View style={[styles.week, !first && styles.weekLine]}>
      <View style={styles.weekTop}>
        <Text style={styles.weekTitle}>{copy.history.weekOf(shortDate(week.start))}</Text>
        {week.weightLb ? (
          <Text style={styles.weekWeight}>
            {formatWeight(displayWeight(week.weightLb, units))}
            <Text style={styles.unit}> {unitWord(units)}</Text>
          </Text>
        ) : null}
      </View>
      <View style={styles.weekNums}>
        <Text style={styles.stat}>
          <Text style={[styles.statNum, missed && styles.statMiss]}>
            {week.lifts}/{week.planned}
          </Text>
          {` ${copy.history.liftsCount}`}
        </Text>
        {week.sport ? (
          <Text style={styles.stat}>
            <Text style={styles.statNum}>{week.sport}</Text>
            {` ${copy.history.minSport}`}
          </Text>
        ) : null}
        {week.cardio ? (
          <Text style={styles.stat}>
            <Text style={styles.statNum}>{Number(week.cardio).toLocaleString("en-US")}</Text>
            {` ${copy.history.kcalExtraBurn}`}
          </Text>
        ) : null}
      </View>
      <Text style={styles.season}>{line}</Text>
    </View>
  );
}

function LiftsPage({
  data,
  infoOpen,
  onInfo,
}: {
  data: HistorySnapshot;
  infoOpen: boolean;
  onInfo: (node: ViewInstance | null) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.panel}>
        <SectionHeading title={copy.history.mainLifts} open={infoOpen} onInfo={onInfo} />
        {data.lifts.length ? (
          data.lifts.map((lift) => <LiftRow key={lift.name} lift={lift} units={data.units} />)
        ) : (
          <Text style={styles.note}>{copy.history.appearsAfter}</Text>
        )}
      </View>
    </ScrollView>
  );
}

function LiftRow({ lift, units }: { lift: LiftTrend; units: string }) {
  const points = sparkPoints(lift.weights);
  const tone = lift.delta === null || lift.delta === 0 ? styles.deltaFlat : lift.delta > 0 ? styles.deltaUp : styles.deltaDown;
  return (
    <View style={styles.liftRow}>
      <Text style={styles.liftName}>{lift.name}</Text>
      <Spark points={points} label={trendLabel(lift.weights, units)} />
      <View style={styles.liftWeight}>
        <Text style={styles.liftLatest}>
          {formatWeight(lift.latest)}
          <Text style={styles.unit}> {unitWord(units)}</Text>
        </Text>
        {lift.delta !== null ? <Text style={[styles.delta, tone]}>{deltaText(lift.delta)}</Text> : null}
      </View>
    </View>
  );
}

function trendLabel(weights: number[], units: string): string {
  const recent = weights.slice(-8);
  const from = formatWeight(displayWeight(recent[0] ?? 0, units));
  const to = formatWeight(displayWeight(recent[recent.length - 1] ?? 0, units));
  return copy.history.topSet(from, to, unitWord(units), recent.length);
}

function Spark({ points, label }: { points: { x: number; y: number }[]; label: string }) {
  const last = points[points.length - 1];
  return (
    <View accessibilityRole="image" accessibilityLabel={label} style={styles.spark}>
      <View style={styles.sparkBase} />
      {points.slice(1).map((point, index) => {
        const previous = points[index];
        if (!previous) return null;
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        return (
          <View
            key={`${point.x}-${point.y}`}
            style={{
              position: "absolute",
              left: (previous.x + point.x) / 2 - length / 2,
              top: (previous.y + point.y) / 2 - 1,
              width: length,
              height: 2,
              borderRadius: 1,
              backgroundColor: theme.fuel,
              transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
            }}
          />
        );
      })}
      {last ? <View style={[styles.sparkDot, { left: last.x - 3, top: last.y - 3 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.orange.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
    backgroundColor: theme.orange.background,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: theme.text,
  },
  switch: { flexDirection: "row", gap: 6, marginBottom: 12 },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.orange.background,
  },
  segmentOn: { backgroundColor: theme.orange.selectedFill },
  segmentText: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.text },
  segmentTextOn: { fontFamily: theme.fonts.bodySemi, color: "#ffffff" },
  pager: { flex: 1, overflow: "hidden" },
  track: { flex: 1, flexDirection: "row" },
  page: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  panel: { backgroundColor: theme.orange.surface, borderRadius: 12, padding: 12, gap: 10 },
  heading: { flexDirection: "row", alignItems: "center" },
  eyebrow: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: theme.orange.accent,
  },
  infoDot: {
    width: 18,
    height: 18,
    marginLeft: 6,
    borderRadius: 9,
    backgroundColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  infoDotOpen: { backgroundColor: theme.orange.accent },
  infoGlyph: { fontFamily: theme.fonts.monoMedium, fontSize: 11, color: "#d4cfcc" },
  infoGlyphOpen: { color: "#231c18" },
  note: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: theme.muted },
  mix: { minHeight: 150, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  mixCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4, minWidth: 0 },
  mixHours: { height: 14, fontFamily: theme.fonts.monoMedium, fontSize: 11, color: "#d4cfcc" },
  mixBar: {
    width: "100%",
    maxWidth: 30,
    borderRadius: 6,
    overflow: "hidden",
    flexDirection: "column-reverse",
    gap: 2,
  },
  mixNow: { opacity: 0.85 },
  mixLabel: { fontFamily: theme.fonts.monoMedium, fontSize: 10, color: theme.muted },
  mixLabelNow: { color: theme.text },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 9, height: 9, borderRadius: 2 },
  legendText: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  monthBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthButton: {
    minWidth: 44,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthButtonOff: { opacity: 0.35 },
  chevron: { fontFamily: theme.fonts.body, fontSize: 20, lineHeight: 22, color: theme.text },
  monthTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.text,
  },
  weekdays: { flexDirection: "row", gap: 4 },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.66,
    color: theme.muted,
  },
  grid: { gap: 4 },
  gridRow: { flexDirection: "row", gap: 4 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 8, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cellEmpty: { backgroundColor: theme.orange.background },
  cellLift: { backgroundColor: LIFT_FILL },
  cellAct: { backgroundColor: ACT_FILL },
  dayNumber: { fontFamily: theme.fonts.mono, fontSize: 14, color: theme.muted },
  dayNumberOn: { fontFamily: theme.fonts.monoMedium },
  dayMuted: { color: theme.muted },
  dayLift: { color: LIFT_INK },
  dayAct: { color: ACT_INK },
  dayBoth: { color: "#ffffff" },
  detail: { marginTop: 2, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE, gap: 6 },
  detailDate: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: theme.orange.accent,
  },
  detailTitle: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 18,
    lineHeight: 24,
    color: theme.text,
  },
  session: { gap: 4 },
  sessionPressed: { opacity: 0.7 },
  sessionLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotLift: { backgroundColor: theme.green.accent },
  dotAct: { backgroundColor: theme.pink.accent },
  sessionText: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.text },
  exercises: { gap: 2 },
  exercise: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  exerciseName: { flex: 1, fontFamily: theme.fonts.body, fontSize: 13, color: "#d4cfcc" },
  added: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.muted },
  exerciseValue: { fontFamily: theme.fonts.monoMedium, fontSize: 13, color: theme.text },
  week: { gap: 4, paddingBottom: 10 },
  weekLine: { borderTopWidth: 1, borderTopColor: LINE, paddingTop: 10 },
  weekTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  weekTitle: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.text },
  weekWeight: { fontFamily: theme.fonts.monoMedium, fontSize: 14, color: theme.text },
  unit: { fontFamily: theme.fonts.mono, fontSize: 11, color: theme.muted },
  weekNums: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stat: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.muted },
  statNum: { fontFamily: theme.fonts.monoMedium, fontSize: 14, color: theme.text },
  statMiss: { color: theme.fuel },
  season: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.muted },
  liftRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  liftName: { flex: 1, fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.text },
  liftWeight: { minWidth: 64, alignItems: "flex-end" },
  liftLatest: { fontFamily: theme.fonts.monoMedium, fontSize: 15, color: theme.text },
  delta: { fontFamily: theme.fonts.monoMedium, fontSize: 12 },
  deltaUp: { color: theme.fuel },
  deltaDown: { color: NEGATIVE },
  deltaFlat: { color: theme.muted },
  spark: { width: 112, height: 32 },
  sparkBase: { position: "absolute", left: 0, right: 0, top: 30, height: 1, backgroundColor: LINE },
  sparkDot: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: theme.fuel },
  backdrop: { flex: 1 },
  popover: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#2f2a27",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  popoverTitle: { fontFamily: theme.fonts.bodySemi, fontSize: 13, color: theme.orange.accent },
  popoverBody: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 19, color: theme.text },
});
