import { GlassView } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Dumbbell, Flame, Settings } from "lucide-react-native";
import { useEffect, useState } from "react";
import { PressableScale } from "@/components/pressable-scale";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Polyline } from "react-native-svg";

import { LiveWorkoutBar } from "@/components/live-workout";
import { copy } from "@/copy";
import { useSolidGlass } from "@/glass";
import { engine, useEngineStore } from "@/store";
import { TabBarSpacer } from "@/tab-bar-inset";
import { theme } from "@/theme";
import { toDisplay } from "@/units";
import { useReduceMotion } from "@/use-reduce-motion";

const COURT = new Set(["pickle", "tennis", "volleyball"]);
const LIFT_MARKS = [10, 50, 100];
const HOUR_MARKS = [10, 50, 100];
const STREAK_MARKS = [6, 12, 16];

type Top = { start: number; w: number; r: number; t: number };
type Milestone = { key: string; mark: string; title: string; t: number; bg: string; color: string };

function lookup(id: string) {
  const table = copy.activityNames as Record<string, string>;
  return table[id] || id;
}

function activityName(id: string) {
  if (id === "lift") return copy.you.lifting;
  if (id === "zone2") return copy.activities.zone2;
  return lookup(id);
}

function monthYear(t: number) {
  return new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function monthShort(t: number) {
  return new Date(t).toLocaleDateString("en-US", { month: "short" });
}

function dayLabel(t: number) {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function memberStamp(week: { createdAt?: number; weekStart?: number; sessions?: { t?: number }[] }) {
  const times = [week.createdAt, ...(week.sessions || []).map((session) => session.t), week.weekStart].filter(
    (time): time is number => typeof time === "number" && Number.isFinite(time) && time > 0,
  );
  return monthYear(times.length ? Math.min(...times) : Date.now());
}

function setText(name: string, weight: number, reps: number, kgMode: boolean) {
  if (engine.isBW(name) && !(weight > 0)) return String(reps);
  const shown = kgMode ? toDisplay(weight) : weight;
  return `${shown} ${copy.history.times} ${reps}`;
}

function hourLabel(hours: number) {
  const text = hours >= 10 ? String(Math.round(hours)) : String(hours).replace(/\.0$/, "");
  return `${text}h`;
}

function milestones(): Milestone[] {
  const sessions = ((engine.wk.sessions || []) as { t?: number; k?: string }[])
    .filter((session) => typeof session.t === "number")
    .slice()
    .sort((a, b) => (a.t || 0) - (b.t || 0));
  const earned: Milestone[] = [];
  let lifts = 0;
  let hours = 0;
  sessions.forEach((session) => {
    const at = session.t || 0;
    if (session.k === "lift") {
      lifts += 1;
      if (LIFT_MARKS.includes(lifts)) {
        earned.push({
          key: `lifts-${lifts}`,
          mark: String(lifts),
          title: copy.you.liftsMilestone(lifts),
          t: at,
          bg: "#1f3029",
          color: theme.green.accent,
        });
      }
    }
    const next = engine.hoursMoved(0, at + 1);
    HOUR_MARKS.forEach((mark) => {
      if (hours < mark && next >= mark) {
        earned.push({
          key: `hours-${mark}`,
          mark: String(mark),
          title: copy.you.hoursMilestone(mark),
          t: at,
          bg: "#2a211c",
          color: theme.fuel,
        });
      }
    });
    hours = next;
  });

  const weeks = ((engine.wk.weeks || []) as { start?: number; counted?: boolean; lifts?: number; planned?: number }[])
    .slice()
    .sort((a, b) => (a.start || 0) - (b.start || 0));
  let run = 0;
  let firstWeek = false;
  weeks.forEach((week) => {
    if (!engine.weekCompleted(week)) {
      run = 0;
      return;
    }
    run += 1;
    const at = week.start || 0;
    if (!firstWeek) {
      firstWeek = true;
      earned.push({
        key: "full-week",
        mark: "1",
        title: copy.you.firstFullWeek,
        t: at,
        bg: "#3a2430",
        color: theme.pink.accent,
      });
    }
    if (STREAK_MARKS.includes(run)) {
      earned.push({
        key: `streak-${run}-${at}`,
        mark: String(run),
        title: copy.you.streakMilestone(run),
        t: at,
        bg: "#3a2430",
        color: theme.pink.accent,
      });
    }
  });

  const prs = engine.recentPrs() as { t: number }[];
  const first = prs[prs.length - 1];
  if (first) {
    earned.push({
      key: "first-pr",
      mark: "PR",
      title: copy.you.firstPrTitle,
      t: first.t,
      bg: "#2a211c",
      color: theme.fuel,
    });
  }
  return earned.sort((a, b) => b.t - a.t);
}

/** You, as a profile of what you've done. Settings opens from the gear. */
export function ProfileScreen() {
  "use no memo";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduce = useReduceMotion();
  useEngineStore((state) => state.version);
  const call = useEngineStore((state) => state.call);
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  const week = engine.wk;
  const kgMode = week.units === "kg";
  const unit = kgMode ? copy.you.kg : copy.you.lb;
  const name = String(week.name || "").trim();
  const since = memberStamp(week);
  const sinceMonth = since.split(" ")[0] || "";
  const sessions = (week.sessions || []) as { t?: number; k?: string }[];
  const liftCount = sessions.filter((session) => session.k === "lift").length;
  const activityCount = sessions.length - liftCount;
  const hours = engine.hoursMoved();
  const streak = engine.weekStreak();
  const closed = ((week.weeks || []) as { start?: number; counted?: boolean; lifts?: number; planned?: number }[])
    .slice()
    .sort((a, b) => (a.start || 0) - (b.start || 0));
  const firstWeek = streak === 0 && !closed.some((item) => engine.weekCompleted(item));
  const recent = closed.slice(-12);
  const flames = recent.map((weekRow) => engine.weekCompleted(weekRow));
  const days = engine.DAYS as { id: string }[];
  const doneLifts = days.filter((day) => week.done?.[day.id]).length;

  const climbs = Object.keys(engine.exHist || {})
    .map((exercise) => {
      const rows = (engine.weekTops(exercise) as Top[]).filter((row) => row.w > 0 || engine.isBW(exercise));
      if (!rows.length) return null;
      const first = rows[0];
      const last = rows[rows.length - 1];
      const from = kgMode ? toDisplay(first.w) : first.w;
      const to = kgMode ? toDisplay(last.w) : last.w;
      return { name: exercise, rows, climb: to - from, first, last };
    })
    .filter((row): row is NonNullable<typeof row> => !!row)
    .sort((a, b) => b.climb - a.climb || b.last.t - a.last.t);
  const strongest = climbs[0];
  const prs = (engine.recentPrs() as { kind: "top" | "reps"; name: string; w: number; r: number; t: number }[]).filter(
    (pr) => Date.now() - pr.t <= 28 * 864e5,
  );
  const from = engine.seasonFrom();
  const played = engine.mostPlayed();
  const mix = engine.timeByKind(from);
  const mixMax = Math.max(1, ...mix.map((row) => row.min));
  const earned = milestones();
  const missingFat = !String(week.bf || "").trim();
  const missingActivity = activityCount === 0;
  const tags = (engine.ACT_IDS as string[])
    .filter((id) => id !== "lift" && engine.enabled(id))
    .sort((a, b) => Number(b === week.mainSport) - Number(a === week.mainSport));

  function saveName() {
    const next = draftName.trim();
    call((api) => {
      api.wk.name = next;
      api.save();
    });
    setNaming(false);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled"
        scrollsToTop
        contentInsetAdjustmentBehavior="never"
      >
        <View style={styles.gearRow}>
          <GearButton onPress={() => router.push("/settings")} />
        </View>
        <View style={styles.header}>
          <Avatar letter={name ? name.slice(0, 1).toUpperCase() : "?"} />
          {naming ? (
            <TextInput
              accessibilityLabel={copy.you.name}
              autoFocus
              value={draftName}
              onChangeText={setDraftName}
              onSubmitEditing={saveName}
              onBlur={saveName}
              placeholder={copy.you.name}
              placeholderTextColor={theme.muted}
              style={styles.nameInput}
            />
          ) : name ? (
            <PressableScale
              kind="text"
              accessibilityRole="button"
              accessibilityLabel={name}
              onPress={() => {
                setDraftName(name);
                setNaming(true);
              }}
            >
              <Text style={styles.name}>{name}</Text>
            </PressableScale>
          ) : (
            <PressableScale
              kind="button"
              accessibilityRole="button"
              onPress={() => {
                setDraftName("");
                setNaming(true);
              }}
              style={styles.addName}
            >
              <Text style={styles.addNameText}>{copy.you.addYourName}</Text>
            </PressableScale>
          )}
          <Text style={styles.since}>{copy.you.memberSince(since)}</Text>
          <View style={styles.tags}>
            {tags.map((id, index) => (
              <View key={id} style={[styles.tag, index === 0 ? styles.tagHot : styles.tagSoft]}>
                <Text style={[styles.tagText, index === 0 ? styles.tagTextHot : styles.tagTextSoft]}>{activityName(id)}</Text>
              </View>
            ))}
            {engine.enabled("lift") ? (
              <View style={[styles.tag, styles.tagLift]}>
                <Text style={[styles.tagText, styles.tagTextLift]}>{copy.you.lifting}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {firstWeek ? (
          <View style={styles.weekCard}>
            <LinearGradient colors={["#2a2329", "#221d1b"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.weekTitle}>
              <Flame size={44} color="#4a3a33" strokeWidth={2} />
              <Text style={styles.weekOne}>{copy.you.weekOne}</Text>
            </View>
            <Text style={styles.weekHint}>{copy.you.lightFirstFlame}</Text>
            {days.length ? (
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>{copy.you.thisWeek}</Text>
                <View style={styles.progressBars}>
                  {days.map((day, index) => (
                    <View key={day.id} style={[styles.progressBar, index < doneLifts && styles.progressBarOn]} />
                  ))}
                </View>
                <Text style={styles.progressCount}>{copy.you.liftsProgress(doneLifts, days.length)}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <StreakCard n={streak} flames={flames} reduce={reduce} />
        )}

        <View style={styles.tiles}>
          <Tile
            label={copy.you.lifts}
            value={String(liftCount)}
            color={theme.green.accent}
            hint={firstWeek && liftCount === 1 ? copy.you.yourFirstOne : copy.you.sinceMonth(sinceMonth)}
          />
          <Tile
            label={copy.you.activities}
            value={String(activityCount)}
            color={theme.pink.accent}
            hint={firstWeek && activityCount === 0 ? copy.you.logOneOnWorkouts : copy.you.sinceMonth(sinceMonth)}
          />
          <Tile label={copy.you.hoursMoved} value={String(hours)} color={theme.fuel} hint={copy.you.liftingAndPlay} />
        </View>

        {missingFat || missingActivity ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {copy.you.finishSettingUp}
            </Text>
            {missingFat ? (
              <SetupRow
                title={copy.you.addBodyFat}
                body={copy.you.addBodyFatBody}
                onPress={() => router.push({ pathname: "/settings", params: { edit: "metrics" } })}
              />
            ) : null}
            {missingActivity ? (
              <SetupRow
                title={copy.you.logFirstActivity}
                body={copy.you.logFirstActivityBody}
                onPress={() => router.push("/")}
              />
            ) : null}
          </View>
        ) : null}

        {strongest ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {copy.you.strongestLift}
              </Text>
              {strongest.rows.length > 1 ? <Text style={styles.aside}>{copy.you.sinceMonth(monthShort(strongest.first.t))}</Text> : null}
            </View>
            <View style={styles.strongRow}>
              <View style={styles.strongCopy}>
                <Text style={styles.strongName}>{strongest.name}</Text>
                <View style={styles.topLine}>
                  <Dumbbell size={14} color={theme.muted} strokeWidth={2} />
                  <Text style={styles.topSet}>{setText(strongest.name, strongest.last.w, strongest.last.r, kgMode)}</Text>
                </View>
                <Text style={[styles.climb, strongest.rows.length > 1 && strongest.climb > 0 && styles.climbUp]}>
                  {strongest.rows.length > 1
                    ? strongest.climb >= 0
                      ? copy.you.sinceYouStarted(String(strongest.climb), unit)
                      : copy.you.downSinceStart(String(Math.abs(strongest.climb)), unit)
                    : copy.you.firstTopSet}
                </Text>
              </View>
              {strongest.rows.length > 1 ? <Spark values={strongest.rows.map((row) => (kgMode ? toDisplay(row.w) : row.w))} /> : null}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.cardHead}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {copy.you.personalRecords}
            </Text>
            {prs.length ? <Text style={styles.aside}>{copy.you.last4Weeks}</Text> : null}
          </View>
          {prs.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.prScroll} contentContainerStyle={styles.prRow}>
              {prs.map((pr) => (
                <View key={`${pr.name}-${pr.t}`} style={styles.prCard}>
                  <Text style={styles.prKind}>{pr.kind === "reps" ? copy.history.prReps : copy.history.prTop}</Text>
                  <Text numberOfLines={1} style={styles.prName}>
                    {pr.name}
                  </Text>
                  <Text style={styles.prValue}>{setText(pr.name, pr.w, pr.r, kgMode)}</Text>
                  <Text style={styles.prDate}>{dayLabel(pr.t)}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.card}>
              <View style={styles.emptyPr}>
                <View style={styles.prBadge}>
                  <Text style={styles.prBadgeText}>PR</Text>
                </View>
                <Text style={styles.emptyCopy}>{copy.you.firstPr}</Text>
              </View>
            </View>
          )}
        </View>

        {played ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {copy.you.mostPlayed}
              </Text>
              <Text style={styles.aside}>{copy.you.thisSeason}</Text>
            </View>
            <Text style={styles.played}>{activityName(played.k)}</Text>
            <Text style={styles.playedLine}>
              {COURT.has(played.k)
                ? copy.you.hoursOnCourt(played.hours, played.n)
                : copy.you.hoursAcross(played.hours, played.n)}
            </Text>
            <View style={styles.mix}>
              {mix.map((row) => (
                <View key={row.k} style={styles.mixRow}>
                  <Text numberOfLines={1} style={styles.mixName}>
                    {activityName(row.k)}
                  </Text>
                  <View style={styles.mixTrack}>
                    <View
                      style={[
                        styles.mixFill,
                        {
                          width: `${Math.round((row.min / mixMax) * 100)}%`,
                          backgroundColor: row.k === "lift" ? theme.green.accent : row.k === played.k ? theme.pink.accent : "#e9b1c5",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.mixHours}>{hourLabel(row.hours)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {copy.you.milestones}
          </Text>
          {earned.length ? (
            <View style={styles.mileGrid}>
              {earned.map((item) => (
                <View key={item.key} style={styles.mileSlot}>
                  <View style={styles.mileCard}>
                    <View style={[styles.mileMark, { backgroundColor: item.bg }]}>
                      <Text style={[styles.mileMarkText, { color: item.color }]}>{item.mark}</Text>
                    </View>
                    <Text style={styles.mileTitle}>{item.title}</Text>
                    <Text style={styles.mileDate}>{dayLabel(item.t)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptyCopy}>{copy.you.milestonesEmpty}</Text>
            </View>
          )}
        </View>

        <Text style={styles.disclaimer}>{copy.you.disclaimer}</Text>
        <TabBarSpacer />
      </ScrollView>
      <LiveWorkoutBar />
    </View>
  );
}

function GearButton({ onPress }: { onPress: () => void }) {
  const solid = useSolidGlass();
  const icon = <Settings size={20} color={theme.text} strokeWidth={1.8} />;
  if (solid) {
    return (
      <PressableScale accessibilityRole="button" accessibilityLabel={copy.you.settings} onPress={onPress} style={styles.gearSolid}>
        {icon}
      </PressableScale>
    );
  }
  return (
    <PressableScale kind="plain" accessibilityRole="button" accessibilityLabel={copy.you.settings} onPress={onPress} style={styles.gearHit}>
      <GlassView isInteractive colorScheme="dark" glassEffectStyle={{ style: "regular" }} style={styles.gearGlass}>
        {icon}
      </GlassView>
    </PressableScale>
  );
}

function Avatar({ letter }: { letter: string }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.avatar}>
      <LinearGradient colors={["#fc96bf", "#fea06a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={styles.avatarLetter}>{letter}</Text>
    </View>
  );
}

function Tile({ label, value, color, hint }: { label: string; value: string; color: string; hint: string }) {
  return (
    <View accessible style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={styles.tileHint}>{hint}</Text>
    </View>
  );
}

function SetupRow({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={styles.setup}>
      <View style={styles.setupCopy}>
        <Text style={styles.setupTitle}>{title}</Text>
        <Text style={styles.setupBody}>{body}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </PressableScale>
  );
}

function StreakCard({ n, flames, reduce }: { n: number; flames: boolean[]; reduce: boolean }) {
  const spin = useSharedValue(0);
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }, { scale: scale.value }],
  }));
  const k = Math.min(1, Math.max(0, n) / 16);
  return (
    <View style={styles.streakCard}>
      <LinearGradient
        colors={[`rgba(252,150,191,${(0.1 + 0.32 * k).toFixed(2)})`, `rgba(254,160,106,${(0.06 + 0.3 * k).toFixed(2)})`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {reduce ? null : <Shine />}
      <PressableScale
        kind="plain"
        accessibilityRole="button"
        accessibilityLabel={copy.you.streakButton(n)}
        onPress={() => {
          if (reduce) return;
          spin.value = withSequence(withTiming(-6, { duration: 180 }), withTiming(4, { duration: 180 }), withTiming(0, { duration: 200 }));
          scale.value = withSequence(withTiming(1.18, { duration: 180 }), withTiming(0.96, { duration: 180 }), withTiming(1, { duration: 200 }));
        }}
        style={styles.streakButton}
      >
        <Reanimated.View style={motion}>
          <Flame size={56} color={theme.fuel} strokeWidth={2} />
        </Reanimated.View>
        <View style={styles.streakNumSlot}>
          <Text style={styles.streakNum}>{n}</Text>
        </View>
        <View style={styles.streakUnitSlot}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.streakUnit}>
            {copy.you.weekUnit(n)} {copy.you.inARow}
          </Text>
        </View>
      </PressableScale>
      <View style={styles.flameRow}>
        {flames.map((on, index) => (
          <Flame key={index} size={18} color={on ? theme.fuel : "rgba(237,234,232,0.22)"} strokeWidth={2} />
        ))}
      </View>
    </View>
  );
}

function Shine() {
  const progress = useSharedValue(0);
  const width = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withSequence(withDelay(700, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) })), withDelay(3000, withTiming(0, { duration: 0 }))),
      -1,
      false,
    );
  }, [progress]);
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: width.value * (-1.2 + progress.value * 2.4) }, { rotate: "18deg" }],
  }));
  return (
    <View
      pointerEvents="none"
      style={styles.shineClip}
      onLayout={(event) => {
        width.value = event.nativeEvent.layout.width;
      }}
    >
      <Reanimated.View style={[styles.shine, sweep]}>
        <LinearGradient
          colors={["transparent", "rgba(252,150,191,0.12)", "rgba(255,255,255,0.28)", "rgba(254,160,106,0.12)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Reanimated.View>
    </View>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const width = 120;
  const height = 56;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : 4 + (index * (width - 8)) / (values.length - 1);
    const y = hi === lo ? height / 2 : 8 + (1 - (value - lo) / (hi - lo)) * (height - 16);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1].split(",");
  return (
    <Svg width={width} height={height} accessibilityElementsHidden>
      <Polyline points={points.join(" ")} fill="none" stroke={theme.fuel} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last[0]} cy={last[1]} r={4} fill={theme.fuel} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.pink.background },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  gearRow: { height: 40, alignItems: "flex-end" },
  gearHit: { width: 40, height: 40 },
  gearGlass: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  gearSolid: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  header: { alignItems: "center", gap: 8, marginTop: -20 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(252,150,191,0.25)",
  },
  avatarLetter: { fontFamily: theme.fonts.display, fontSize: 40, color: "#2a1520" },
  name: {
    fontFamily: theme.fonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: theme.text,
    textTransform: "uppercase",
    textAlign: "center",
  },
  nameInput: {
    minHeight: 44,
    minWidth: 160,
    textAlign: "center",
    fontFamily: theme.fonts.display,
    fontSize: 34,
    color: theme.text,
    textTransform: "uppercase",
  },
  addName: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: theme.radii.pill,
    backgroundColor: "#3a2430",
    alignItems: "center",
    justifyContent: "center",
  },
  addNameText: { fontFamily: theme.fonts.bodySemi, fontSize: 15, color: theme.pink.accent },
  since: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.muted },
  tags: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 2 },
  tag: { borderRadius: theme.radii.pill, paddingHorizontal: 12, paddingVertical: 5 },
  tagHot: { backgroundColor: "#3a2430" },
  tagSoft: { backgroundColor: "#2a2329" },
  tagLift: { backgroundColor: "#1f3029" },
  tagText: { fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  tagTextHot: { color: theme.pink.accent },
  tagTextSoft: { color: "#e9b1c5" },
  tagTextLift: { color: theme.green.accent },
  weekCard: { borderRadius: 18, padding: 16, gap: 10, overflow: "hidden" },
  weekTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  weekOne: { fontFamily: theme.fonts.display, fontSize: 34, lineHeight: 38, color: theme.text, textTransform: "uppercase" },
  weekHint: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.muted },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  progressLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  progressBars: { flex: 1, flexDirection: "row", gap: 4 },
  progressBar: { flex: 1, height: 8, borderRadius: theme.radii.pill, backgroundColor: "#34302c" },
  progressBarOn: { backgroundColor: theme.fuel },
  progressCount: { fontFamily: theme.fonts.mono, fontSize: 12, color: theme.text },
  streakCard: { borderRadius: 18, padding: 16, gap: 12, overflow: "hidden", backgroundColor: "#221d1b" },
  streakButton: { flexDirection: "row", alignItems: "center", gap: 8 },
  // Lucide flame at 56, stroke 2. Opaque ink is y 2.25–51.38 (height 49.13),
  // center 26.81. The numeral's line is 74.16, taller than the flame, so this
  // slot is that full line. A 56pt slot was clipping the bottom of 0.
  streakNumSlot: { height: 74.16, justifyContent: "center", overflow: "visible" },
  streakNum: {
    fontFamily: theme.fonts.display,
    // Ranchers "1" ink is 0.828em, so 59.33pt is 49.12pt tall. translateY -1.55
    // puts that ink on the flame once the 56pt flame is centered in this taller row.
    fontSize: 59.33,
    lineHeight: 74.16,
    includeFontPadding: false,
    color: theme.fuel,
    transform: [{ translateY: -1.55 }],
  },
  // Flame height. The 26pt label line centered here spans 15–41 and 27–53 after
  // the 12pt shift, so it stays inside the slot without overflow or more height.
  streakUnitSlot: { height: 56, flex: 1, justifyContent: "center" },
  streakUnit: {
    fontFamily: theme.fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: theme.text,
    textTransform: "uppercase",
    // Emma's approved offset: 12pt down from centered. "WEEKS IN A ROW" is
    // 157pt wide at 24pt, so it fits on one line beside 12 on a 375pt screen.
    transform: [{ translateY: 12 }],
  },
  flameRow: { flexDirection: "row", justifyContent: "flex-start", gap: 3 },
  shineClip: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  shine: {
    position: "absolute",
    top: -40,
    bottom: -40,
    width: "70%",
  },
  tiles: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, backgroundColor: theme.orange.surface, borderRadius: 14, padding: 12, gap: 2 },
  tileLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  tileValue: { fontFamily: theme.fonts.monoMedium, fontSize: 26, lineHeight: 30 },
  tileHint: { fontFamily: theme.fonts.body, fontSize: 11, color: "#8f8783" },
  section: { gap: 8 },
  sectionTitle: { fontFamily: theme.fonts.bodySemi, fontSize: 15, color: theme.text },
  card: { backgroundColor: theme.orange.surface, borderRadius: 18, padding: 16, gap: 10 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  aside: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  setup: {
    backgroundColor: theme.orange.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  setupCopy: { flex: 1, gap: 2 },
  setupTitle: { fontFamily: theme.fonts.bodySemi, fontSize: 15, color: theme.text },
  setupBody: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.muted },
  chevron: { fontFamily: theme.fonts.body, fontSize: 22, color: theme.pink.accent },
  strongRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  strongCopy: { flex: 1, gap: 2 },
  strongName: { fontFamily: theme.fonts.bodySemi, fontSize: 16, color: theme.text },
  topLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  topSet: { fontFamily: theme.fonts.mono, fontSize: 22, color: theme.text },
  climb: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.muted },
  climbUp: { color: theme.fuel },
  prScroll: { marginHorizontal: -16 },
  prRow: { gap: 8, paddingHorizontal: 16 },
  prCard: { width: 136, backgroundColor: "#2a211c", borderRadius: 14, padding: 12, gap: 2 },
  prKind: { fontFamily: theme.fonts.bodySemi, fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: theme.fuel },
  prName: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.text },
  prValue: { fontFamily: theme.fonts.monoMedium, fontSize: 20, color: theme.text },
  prDate: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  emptyPr: { flexDirection: "row", alignItems: "center", gap: 12 },
  prBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2a211c",
    alignItems: "center",
    justifyContent: "center",
  },
  prBadgeText: { fontFamily: theme.fonts.display, fontSize: 16, color: theme.fuel },
  emptyCopy: { flex: 1, fontFamily: theme.fonts.body, fontSize: 14, color: theme.muted },
  played: { fontFamily: theme.fonts.display, fontSize: 30, lineHeight: 34, color: theme.pink.accent, textTransform: "uppercase" },
  playedLine: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.text },
  mix: { gap: 6 },
  mixRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mixName: { width: 72, fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  mixTrack: { flex: 1, height: 8, borderRadius: theme.radii.pill, backgroundColor: "#34302c", overflow: "hidden" },
  mixFill: { height: 8, borderRadius: theme.radii.pill },
  mixHours: { width: 52, textAlign: "right", fontFamily: theme.fonts.mono, fontSize: 12, color: theme.text },
  mileGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  mileSlot: { width: "50%", padding: 4 },
  mileCard: { backgroundColor: theme.orange.surface, borderRadius: 16, padding: 14, gap: 6 },
  mileMark: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  mileMarkText: { fontFamily: theme.fonts.display, fontSize: 18 },
  mileTitle: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.text },
  mileDate: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  disclaimer: { fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 18, color: theme.muted },
});
