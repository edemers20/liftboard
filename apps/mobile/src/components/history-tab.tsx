import { router } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
import Svg, { Circle, Polyline } from "react-native-svg";

import { copy } from "@/copy";
import type { HistoryDay, HistoryLift, HistoryPr, HistorySession, HistorySnapshot, HistoryWeek, MuscleBar, SessionExercise } from "@/history-data";
import { Info, TabWorkouts } from "@/icons";
import {
  displayWeight,
  formatHours,
  formatWeight,
  linePoints,
  MIX_ORDER,
  monthGrid,
  weekRange,
  type MixKind,
  type MonthCell,
  type MixWeek,
} from "@/history-model";
import { openPlan } from "@/links";
import { storage } from "@/storage";
import { engine, useEngineStore } from "@/store";
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

const UNDER = "#e7b94a";
const DONE_PILL = "#1f3029";
const TRACK = "#34302c";
const PR_CARD = "#2a211c";
const HAIRLINE = "#2f2a27";

type InfoId = "mix";

const INFO: Record<InfoId, { title: string; body: string }> = {
  mix: { title: copy.history.weekMix, body: copy.history.weekMixInfo },
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

function signedDelta(delta: number): string {
  const amount = formatWeight(Math.abs(delta));
  if (delta < 0) return `−${amount}`;
  return `+${amount}`;
}

function formatCount(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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
            <WeeksPage data={data} />
          </View>
          <View
            style={{ width, height: "100%" }}
            accessibilityElementsHidden={view !== "lifts"}
            importantForAccessibility={view === "lifts" ? "auto" : "no-hide-descendants"}
            pointerEvents={view === "lifts" ? "auto" : "none"}
          >
            <LiftsPage data={data} />
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
        hitSlop={14}
        onPress={() => onInfo(ref.current)}
        style={styles.infoButton}
      >
        <Info size={16} color={open ? theme.orange.accent : "#d4cfcc"} />
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
  const averageHours = mix.averageMinutes / 60;
  const trend = mix.averageMinutes > 0 ? averageHours.toFixed(1) : "";
  return (
    <View style={styles.panel}>
      <SectionHeading title={copy.history.weekMix} open={open} onInfo={onInfo} />
      <View
        accessibilityRole="image"
        accessibilityLabel={[mixSummary(mix.weeks), trend ? copy.history.aboutAWeek(trend).replace(/^ · /, "") : ""]
          .filter(Boolean)
          .join(". ")}
        style={styles.mix}
      >
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
        {trend ? (
          <View
            pointerEvents="none"
            style={[styles.trend, { bottom: 18 + (mix.averageMinutes / mix.max) * BAR_MAX - 7 }]}
          >
            <View style={styles.trendLine} />
            <Text style={styles.trendValue}>{trend}</Text>
          </View>
        ) : null}
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

function WeeksPage({ data }: { data: HistorySnapshot }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      {data.weeks.length ? (
        <>
          <View style={styles.streakRow}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.streakDots}>
              {data.dots.map((done, index) => (
                <View key={index} style={[styles.streakDot, { backgroundColor: done ? theme.fuel : TRACK }]} />
              ))}
            </View>
            <Text style={styles.streakText}>{copy.history.streakWeeks(data.streak)}</Text>
          </View>
          {data.weeks.map((week) => (
            <WeekCard
              key={week.start}
              week={week}
              open={open === week.start}
              onToggle={() => setOpen((current) => (current === week.start ? null : week.start))}
            />
          ))}
        </>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => openPlan("week")}>
          <Text style={styles.note}>{copy.history.savesWhen}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function WeekCard({ week, open, onToggle }: { week: HistoryWeek; open: boolean; onToggle: () => void }) {
  const expandable = !!week.muscles || week.lifts < week.planned;
  const pill = week.counted ? copy.history.counted : week.completed ? copy.history.completed : copy.history.liftsOf(week.lifts, week.planned);
  const header = (
    <>
      <View style={styles.weekTop}>
        <Text numberOfLines={1} style={styles.weekRange}>{weekRange(week.start)}</Text>
        <View style={[styles.pill, week.completed ? styles.pillDone : styles.pillOpen]}>
          <Text style={[styles.pillText, week.completed ? styles.pillTextDone : styles.pillTextOpen]}>{pill}</Text>
        </View>
      </View>
      <View style={styles.weekStats}>
        <Stat label={copy.history.lifts} value={`${week.lifts}/${week.planned}`} />
        <Stat label={copy.history.sets} value={String(week.sets)} />
        <Stat label={copy.history.exerciseKcal} value={Math.round(week.burn).toLocaleString("en-US")} />
      </View>
    </>
  );
  return (
    <View style={styles.card}>
      {expandable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={onToggle}
          style={styles.cardButton}
        >
          {header}
        </Pressable>
      ) : (
        <View style={styles.cardButton}>{header}</View>
      )}
      {open && expandable ? (
        <Reveal>
          <WeekDetail week={week} />
        </Reveal>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function WeekDetail({ week }: { week: HistoryWeek }) {
  return (
    <View style={styles.detailBlock}>
      {week.muscles ? (
        <View style={styles.muscleBlock}>
          <View style={styles.muscleHead}>
            <Text style={styles.muscleTitle}>{copy.history.setsByMuscle}</Text>
            <Text style={styles.muscleHint}>{copy.history.donePlanned}</Text>
          </View>
          {week.muscles.map((muscle) => (
            <MuscleRow key={muscle.name} muscle={muscle} />
          ))}
        </View>
      ) : null}
      {week.lifts < week.planned ? (
        <View style={styles.missedRow}>
          <Text style={styles.missedText}>{week.miss.length ? copy.history.missed(joinNames(week.miss)) : ""}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={week.counted ? copy.history.undo : copy.history.countCompleted}
            onPress={() => useEngineStore.getState().call((api) => api.countWeek(week.start))}
            style={styles.countButton}
          >
            <Text style={styles.countText}>{week.counted ? copy.history.undo : copy.history.countCompleted}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function MuscleRow({ muscle }: { muscle: MuscleBar }) {
  const met = muscle.planned <= 0 || muscle.done >= muscle.planned;
  const width = muscle.planned > 0 ? Math.min(100, (muscle.done / muscle.planned) * 100) : muscle.done > 0 ? 100 : 0;
  const color = met ? theme.green.accent : UNDER;
  return (
    <View
      accessibilityLabel={`${muscle.name} ${formatCount(muscle.done)}/${formatCount(muscle.planned)}`}
      style={styles.muscleRow}
    >
      <Text style={styles.muscleName}>{muscle.name}</Text>
      <View style={styles.muscleTrack}>
        <View style={[styles.muscleFill, { width: `${width}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.muscleCount, { color }]}>
        {formatCount(muscle.done)}/{formatCount(muscle.planned)}
      </Text>
    </View>
  );
}

function LiftsPage({ data }: { data: HistorySnapshot }) {
  const [open, setOpen] = useState<string | null>(null);
  const [tip, setTip] = useState(false);
  if (!data.lifts.length && !data.prs.length) {
    return (
      <ScrollView contentContainerStyle={styles.stack}>
        <Text style={styles.note}>{copy.history.appearsAfter}</Text>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      {data.prs.length ? (
        <View style={styles.prBlock}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {copy.history.recentPrs}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.prScroll}
            style={styles.prBleed}
          >
            {data.prs.map((pr) => (
              <PrCard key={`${pr.name}-${pr.t}-${pr.kind}`} pr={pr} units={data.units} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {data.lifts.length ? (
        <View style={styles.liftHead}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {copy.history.mainLifts}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.history.about1Rm}
            accessibilityState={{ expanded: tip }}
            hitSlop={8}
            onPress={() => setTip((current) => !current)}
            style={styles.liftInfo}
          >
            <Info size={16} color={theme.muted} />
          </Pressable>
        </View>
      ) : null}
      {data.lifts.length && tip ? (
        <View accessibilityRole="text" style={styles.tip}>
          <Text style={styles.tipBody}>
            <Text style={styles.tipStrong}>{copy.history.oneRmLead}</Text>
            {copy.history.oneRmBody}
          </Text>
          <View style={styles.tipRow}>
            <TabWorkouts size={14} color={theme.muted} />
            <Text style={styles.tipMuted}>{copy.history.topSetMeans}</Text>
          </View>
          <Text style={styles.tipMuted}>{copy.history.last8}</Text>
        </View>
      ) : null}
      {data.lifts.map((lift) => (
        <LiftCard
          key={lift.name}
          lift={lift}
          units={data.units}
          open={open === lift.name}
          onToggle={() => setOpen((current) => (current === lift.name ? null : lift.name))}
        />
      ))}
    </ScrollView>
  );
}

function PrCard({ pr, units }: { pr: HistoryPr; units: string }) {
  const load = engine.isBW(pr.name) && !(pr.weight > 0) ? copy.history.bw : formatWeight(pr.weight);
  const value = `${load} ${copy.history.times} ${pr.reps}`;
  const kind = pr.kind === "reps" ? copy.history.prReps : copy.history.prTop;
  return (
    <View accessibilityLabel={`${kind}, ${pr.name}, ${value}, ${shortDate(pr.t)}`} style={styles.prCard}>
      <Text style={styles.prKind}>{kind}</Text>
      <Text numberOfLines={1} style={styles.prName}>
        {pr.name}
      </Text>
      <Text style={styles.prValue}>{value}</Text>
      <Text style={styles.prDate}>{shortDate(pr.t)}</Text>
    </View>
  );
}

function LiftCard({
  lift,
  units,
  open,
  onToggle,
}: {
  lift: HistoryLift;
  units: string;
  open: boolean;
  onToggle: () => void;
}) {
  const unit = unitWord(units);
  const top = `${formatWeight(lift.weight)} ${copy.history.times} ${lift.reps}`;
  const delta = lift.delta === null ? "" : `${signedDelta(lift.delta)} ${copy.history.in8wk}`;
  const rising = (lift.delta ?? 0) > 0;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${lift.name}. ${formatWeight(lift.e1)} ${copy.history.oneRm(unit)}. ${copy.history.prTop} ${top}${delta ? `. ${delta}` : ""}`}
        onPress={onToggle}
        style={styles.liftButton}
      >
        <View style={styles.liftCopy}>
          <Text numberOfLines={1} style={styles.liftName}>
            {lift.name}
          </Text>
          <View style={styles.e1Row}>
            <Text style={styles.e1Value}>{formatWeight(lift.e1)}</Text>
            <Text style={styles.e1Unit}>{copy.history.oneRm(unit)}</Text>
          </View>
          <View style={styles.topLine}>
            <View accessibilityLabel={copy.history.prTop} accessibilityRole="image">
              <TabWorkouts size={14} color={theme.muted} />
            </View>
            <Text style={styles.topSet}>{top}</Text>
            {delta ? (
              <Text style={styles.deltaLine}>
                {" · "}
                <Text style={{ color: rising ? theme.green.accent : theme.muted }}>{delta}</Text>
              </Text>
            ) : null}
          </View>
        </View>
        <Spark values={lift.series} label={`${lift.name}. ${formatWeight(lift.e1)} ${copy.history.oneRm(unit)}`} />
      </Pressable>
      {open ? (
        <Reveal>
          <View style={styles.liftTable}>
            <View style={styles.tableHead}>
              <Text style={styles.tableLabel}>{copy.history.weekColumn}</Text>
              <Text style={styles.tableLabel}>{copy.history.topSetColumn}</Text>
              <Text style={[styles.tableLabel, styles.tableRight]}>{copy.history.oneRmColumn}</Text>
            </View>
            {lift.rows
              .slice()
              .reverse()
              .map((row) => (
                <View key={row.start} style={styles.tableRow}>
                  <Text style={styles.tableWeek}>{shortDate(row.start)}</Text>
                  <Text style={styles.tableMono}>
                    {formatWeight(row.weight)} {copy.history.times} {row.reps}
                  </Text>
                  <Text style={[styles.tableMono, styles.tableRight, row.pr && styles.tablePr]}>
                    {formatWeight(row.e1)}
                    {row.pr ? ` ${copy.history.prMark}` : ""}
                  </Text>
                </View>
              ))}
          </View>
        </Reveal>
      ) : null}
    </View>
  );
}

function Spark({ values, label }: { values: number[]; label: string }) {
  const points = linePoints(values);
  const last = points[points.length - 1];
  return (
    <View accessibilityRole="image" accessibilityLabel={label} style={styles.spark}>
      <Svg width={96} height={44}>
        {points.length > 1 ? (
          <Polyline
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={theme.green.accent}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {last ? <Circle cx={last.x} cy={last.y} r={3.5} fill={theme.green.accent} /> : null}
      </Svg>
    </View>
  );
}

function Reveal({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    }).start();
  }, [progress, reduce]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [reduce ? 0 : 10, 0] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
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
  infoButton: { marginLeft: 6 },
  note: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: theme.muted },
  mix: { minHeight: 150, flexDirection: "row", alignItems: "flex-end", gap: 8, position: "relative" },
  trend: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendLine: { flex: 1, height: 1, backgroundColor: theme.fuel },
  trendValue: { fontFamily: theme.fonts.monoMedium, fontSize: 11, color: theme.fuel },
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
  stack: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 2, paddingVertical: 4 },
  streakDots: { flexDirection: "row", gap: 4, flexShrink: 1 },
  streakDot: { width: 14, height: 14, borderRadius: 4 },
  streakText: { flexShrink: 1, fontFamily: theme.fonts.body, fontSize: 13, color: theme.fuel },
  card: { backgroundColor: theme.orange.surface, borderRadius: 16, overflow: "hidden" },
  cardButton: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  weekTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  weekRange: {
    flexShrink: 1,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    lineHeight: 26,
    textTransform: "uppercase",
    color: theme.text,
  },
  pill: { flexShrink: 0, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillDone: { backgroundColor: DONE_PILL },
  pillOpen: { backgroundColor: HAIRLINE },
  pillText: { fontFamily: theme.fonts.bodySemi, fontSize: 12 },
  pillTextDone: { color: theme.green.accent },
  pillTextOpen: { color: theme.muted },
  weekStats: { flexDirection: "row", gap: 8 },
  statCol: { flex: 1 },
  statLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  statValue: { fontFamily: theme.fonts.monoMedium, fontSize: 18, color: theme.text },
  detailBlock: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  muscleBlock: { gap: 8, borderTopWidth: 1, borderTopColor: HAIRLINE, paddingTop: 12 },
  muscleHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  muscleTitle: { fontFamily: theme.fonts.bodySemi, fontSize: 13, color: theme.text },
  muscleHint: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  muscleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  muscleName: { width: 100, fontFamily: theme.fonts.body, fontSize: 13, color: theme.text },
  muscleTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: TRACK, overflow: "hidden" },
  muscleFill: { height: 6, borderRadius: 999 },
  muscleCount: { width: 52, textAlign: "right", fontFamily: theme.fonts.mono, fontSize: 12 },
  missedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "#1f1b19",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  missedText: { flex: 1, fontFamily: theme.fonts.body, fontSize: 13, color: theme.muted },
  countButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: HAIRLINE,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontFamily: theme.fonts.bodySemi, fontSize: 13, color: theme.text },
  prBlock: { gap: 8 },
  sectionTitle: { fontFamily: theme.fonts.bodySemi, fontSize: 15, color: theme.text },
  prBleed: { marginHorizontal: -16 },
  prScroll: { paddingHorizontal: 16, gap: 8 },
  prCard: { width: 150, backgroundColor: PR_CARD, borderRadius: 14, padding: 12, gap: 2 },
  prKind: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.44,
    textTransform: "uppercase",
    color: theme.fuel,
  },
  prName: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.text },
  prValue: { fontFamily: theme.fonts.monoMedium, fontSize: 20, color: theme.text },
  prDate: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  liftHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  liftInfo: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  tip: { backgroundColor: "#2f2a27", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  tipBody: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: theme.text },
  tipStrong: { fontFamily: theme.fonts.bodySemi, fontSize: 13, color: theme.text },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipMuted: { flex: 1, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: theme.muted },
  liftButton: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  liftCopy: { flex: 1, minWidth: 0 },
  liftName: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.text },
  e1Row: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  e1Value: { fontFamily: theme.fonts.monoMedium, fontSize: 26, lineHeight: 32, color: theme.text },
  e1Unit: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  topLine: { flexDirection: "row", alignItems: "center", gap: 5, fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  topSet: { fontFamily: theme.fonts.mono, fontSize: 12, color: theme.text },
  deltaLine: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  spark: { width: 96, height: 44 },
  liftTable: { paddingHorizontal: 16, paddingBottom: 14, gap: 6 },
  tableHead: { flexDirection: "row", borderTopWidth: 1, borderTopColor: HAIRLINE, paddingTop: 10 },
  tableRow: { flexDirection: "row", alignItems: "center" },
  tableLabel: { flex: 1, fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  tableWeek: { flex: 1, fontFamily: theme.fonts.body, fontSize: 13, color: theme.muted },
  tableMono: { flex: 1, fontFamily: theme.fonts.mono, fontSize: 13, color: theme.text },
  tableRight: { textAlign: "right" },
  tablePr: { color: theme.fuel },
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
