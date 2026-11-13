import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  activityName,
  activitySessionsOn,
  addDays,
  answerYesterday,
  canLogDay,
  chipIds,
  dayLine,
  isRecent,
  logActivity,
  logOther,
  loggedOf,
  otherIds,
  plannedOf,
  shiftWeek,
  showReminder,
  showRest,
  stampOn,
  startOfDay,
  stripFor,
  useNotice,
  yesterdayOpen,
  type ActSession,
} from "@/activity-log";
import { copy, fill } from "@/copy";
import { haptic } from "@/haptic";
import { openPlan, takeWorkoutsDay } from "@/links";
import { readPlan } from "@/plan-model";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { toDisplay } from "@/units";
import { nativeDriver, useReduceMotion } from "@/use-reduce-motion";
import { canSwapDay, SwapSheet, type SwapAnchor } from "@/components/swap-sheet";
import { Swap } from "@/icons";
import { ShareBox } from "@/workout/share-box";

function startedInField(event: { nativeEvent: { target?: unknown } }) {
  const target = event.nativeEvent.target as { closest?: (selector: string) => unknown; tagName?: string } | null;
  if (target && typeof target === "object") {
    if (typeof target.closest === "function" && target.closest("input, textarea")) return true;
    if (typeof target.tagName === "string" && /^(input|textarea)$/i.test(target.tagName)) return true;
  }
  const state = TextInput.State as {
    currentlyFocusedInput?: () => unknown;
    currentlyFocusedField?: () => unknown;
  };
  const focused = state.currentlyFocusedInput?.() ?? state.currentlyFocusedField?.();
  return focused != null && target != null && focused === target;
}

export default function WorkoutsScreen() {
  useEngineStore((state) => state.version);
  const reduce = useReduceMotion();
  const [offset, setOffset] = useState(0);
  const [otherOpen, setOtherOpen] = useState(false);
  const offsetRef = useRef(0);
  const reduceRef = useRef(reduce);
  const moving = useRef(false);
  const slide = useRef(new Animated.Value(0)).current;
  const stripSlide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  offsetRef.current = offset;
  reduceRef.current = reduce;

  function go(next: number) {
    const current = offsetRef.current;
    if (moving.current || next === current) return;
    const destination = stripFor(next);
    if (destination.weekOffset < -8 || destination.weekOffset > 1) return;
    const direction = next > current ? 1 : -1;
    const weekMove = stripFor(current).weekOffset !== destination.weekOffset;
    moving.current = true;
    offsetRef.current = next;
    setOffset(next);
    if (reduceRef.current) {
      slide.setValue(0);
      stripSlide.setValue(0);
      fade.setValue(0.35);
      Animated.timing(fade, { toValue: 1, duration: 120, useNativeDriver: nativeDriver }).start(() => {
        moving.current = false;
      });
      return;
    }
    slide.setValue(direction * 36);
    Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: nativeDriver }).start(() => {
      moving.current = false;
    });
    if (weekMove) {
      stripSlide.setValue(direction * 48);
      Animated.timing(stripSlide, { toValue: 0, duration: 220, useNativeDriver: nativeDriver }).start();
    }
  }

  const goRef = useRef(go);
  goRef.current = go;
  useFocusEffect(
    useCallback(() => {
      const next = takeWorkoutsDay();
      if (next != null) goRef.current(next);
    }, []),
  );

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (event, gesture) => {
        if (startedInField(event)) return false;
        return Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
      },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) < 56) return;
        const current = offsetRef.current;
        const info = stripFor(current);
        if (gesture.dx < 0 && info.canNextDay) goRef.current(current + 1);
        if (gesture.dx > 0 && info.canPrevDay) goRef.current(current - 1);
      },
    }),
  ).current;

  const stripPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (event, gesture) => {
        if (startedInField(event)) return false;
        return Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
      },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) < 40) return;
        const current = offsetRef.current;
        const info = stripFor(current);
        if (gesture.dx < 0 && info.canNextWeek) goRef.current(shiftWeek(current, 1));
        if (gesture.dx > 0 && info.canPrevWeek) goRef.current(shiftWeek(current, -1));
      },
    }),
  ).current;

  const strip = stripFor(offset);
  const selected = addDays(startOfDay(Date.now()), offset);
  const activities = activitySessionsOn(selected);

  function logOnDay(id: string, turnedOn: boolean) {
    const at = stampOn(selected, offset === 0);
    if (turnedOn) {
      logOther(id, at);
      setOtherOpen(false);
      useNotice.getState().show([copy.workouts.loggedToast(activityName(id)), copy.workouts.added]);
      return;
    }
    logActivity(id, at);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.liftBoard}
        </Text>
        <Pressable
          style={[styles.today, offset === 0 && styles.todayOff]}
          disabled={offset === 0}
          onPress={() => go(0)}
          accessibilityRole="button"
          accessibilityState={{ disabled: offset === 0 }}
        >
          <Text style={[styles.todayText, offset === 0 && styles.todayTextOff]}>{copy.workouts.today}</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.strip} {...stripPan.panHandlers}>
          <Pressable
            style={styles.weekArrow}
            disabled={!strip.canPrevWeek}
            onPress={() => strip.canPrevWeek && go(shiftWeek(offset, -1))}
            accessibilityRole="button"
            accessibilityLabel={copy.workouts.previousWeek}
            accessibilityState={{ disabled: !strip.canPrevWeek }}
          >
            <Text style={[styles.weekArrowText, !strip.canPrevWeek && styles.dimmed]}>‹</Text>
          </Pressable>
          <Animated.View style={[styles.cells, { transform: [{ translateX: reduce ? 0 : stripSlide }] }]}>
            {strip.days.map((day) => (
              <Pressable
                key={day.offset}
                style={[
                  styles.cell,
                  day.past && styles.cellPast,
                  day.today && styles.cellToday,
                  day.selected && styles.cellSelected,
                ]}
                onPress={() => {
                  if (day.offset !== offset) haptic.selection();
                  go(day.offset);
                }}
                accessibilityRole="button"
                accessibilityLabel={day.label}
                accessibilityState={{ selected: day.selected }}
              >
                <Text
                  style={[
                    styles.cellLetter,
                    day.today && styles.cellLetterToday,
                    day.past && !day.today && styles.cellPastText,
                  ]}
                >
                  {day.letter}
                </Text>
                <Text style={[styles.cellDate, day.today && styles.cellLetterToday, day.past && !day.selected && styles.cellPastText]}>
                  {day.date.getDate()}
                </Text>
                <View style={styles.dots}>
                  {day.lift ? <View style={styles.dotLift} /> : null}
                  {day.activity ? <View style={styles.dotActivity} /> : null}
                  {day.usual ? <View style={styles.dotUsual} /> : null}
                </View>
              </Pressable>
            ))}
          </Animated.View>
          <Pressable
            style={styles.weekArrow}
            disabled={!strip.canNextWeek}
            onPress={() => strip.canNextWeek && go(shiftWeek(offset, 1))}
            accessibilityRole="button"
            accessibilityLabel={copy.workouts.nextWeek}
            accessibilityState={{ disabled: !strip.canNextWeek }}
          >
            <Text style={[styles.weekArrowText, !strip.canNextWeek && styles.dimmed]}>›</Text>
          </Pressable>
        </View>

        <View style={styles.below} {...pan.panHandlers}>
        <View style={styles.dayLine}>
          <Pressable
            style={styles.dayArrow}
            disabled={!strip.canPrevDay}
            onPress={() => go(offset - 1)}
            accessibilityRole="button"
            accessibilityLabel={copy.workouts.previousDay}
            accessibilityState={{ disabled: !strip.canPrevDay }}
          >
            <Text style={[styles.dayArrowText, !strip.canPrevDay && styles.dimmed]}>‹</Text>
          </Pressable>
          <Text style={styles.dayLabel}>{dayLine(offset)}</Text>
          <Pressable
            style={styles.dayArrow}
            disabled={!strip.canNextDay}
            onPress={() => go(offset + 1)}
            accessibilityRole="button"
            accessibilityLabel={copy.workouts.nextDay}
            accessibilityState={{ disabled: !strip.canNextDay }}
          >
            <Text style={[styles.dayArrowText, !strip.canNextDay && styles.dimmed]}>›</Text>
          </Pressable>
        </View>

        {offset === 0 ? <YesterdayBanner /> : null}
        {offset === 0 ? <SwapBanner onOpen={(id) => router.push({ pathname: "/workout/[id]", params: { id } })} /> : null}

        <Animated.View style={[styles.dayBody, { transform: [{ translateX: reduce ? 0 : slide }], opacity: fade }]}>
          <View style={styles.cards}>
            <LiftCards
              offset={offset}
              onOpen={(id) => router.push({ pathname: "/workout/[id]", params: { id } })}
              onJump={go}
              onMoved={() => setOffset(0)}
            />
            {activities.map((session) => (
              <ActivityCard key={session.t} session={session} />
            ))}
            {showReminder(offset) ? (
              <View style={styles.reminder}>
                <Text style={styles.eyebrow}>{copy.workouts.activityDay}</Text>
                <Text style={styles.reminderText}>
                  {offset === 0 ? copy.workouts.logBelow : copy.workouts.usually}
                </Text>
              </View>
            ) : null}
            {showRest(offset) ? (
              <View style={styles.rest}>
                <Text style={styles.restEyebrow}>{copy.workouts.rest}</Text>
                <Text style={styles.restTitle}>{copy.workouts.nothingLogged}</Text>
              </View>
            ) : null}
          </View>
          {offset === 0 ? <FuelLink /> : null}
          <ActivityChips
            offset={offset}
            otherOpen={otherOpen}
            onToggle={() => setOtherOpen((open) => !open)}
            onLog={logOnDay}
          />
        </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FuelLink() {
  const version = useEngineStore((state) => state.version);
  const model = useMemo(() => readPlan(), [version]);
  if (!engine.wk.setupDone) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.plan.fuelRecovery}
      onPress={() => openPlan("week")}
      style={styles.fuel}
    >
      <View style={styles.fuelMain}>
        <Text style={styles.fuelLabel}>{copy.plan.fuelToday}</Text>
        <Text style={styles.fuelLine}>
          <Text style={styles.fuelValue}>{model.fuel.today}</Text>
          <Text style={styles.fuelUnit}>{` ${fill(copy.plan.kcal, "").trim()}`}</Text>
        </Text>
      </View>
      <RecoveryBit label={copy.plan.lowerBody} hours={model.recovery.lower} />
      <RecoveryBit label={copy.plan.upperBody} hours={model.recovery.upper} />
    </Pressable>
  );
}

function RecoveryBit({ label, hours }: { label: string; hours: number | null }) {
  return (
    <View style={styles.fuelBit}>
      <Text style={styles.fuelBitLabel}>{label}</Text>
      {hours == null ? (
        <Text style={styles.fuelReady}>{copy.plan.ready}</Text>
      ) : (
        <Text style={styles.fuelHours}>
          {hours}
          <Text style={styles.fuelHoursUnit}>{` ${copy.plan.hoursRest}`}</Text>
        </Text>
      )}
    </View>
  );
}

function YesterdayBanner() {
  "use no memo";
  useEngineStore((state) => state.version);
  const open = yesterdayOpen();
  if (!open) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{copy.workouts.yesterday}</Text>
      <View style={styles.chips}>
        {open.map((id) => (
          <Pressable
            key={id}
            style={styles.bannerChip}
            onPress={() => answerYesterday(id)}
            accessibilityRole="button"
          >
            <Text style={styles.bannerChipText}>{activityName(id)}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.ghostChip} onPress={() => answerYesterday(null)} accessibilityRole="button">
          <Text style={styles.ghostChipText}>{copy.workouts.no}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function nextLiftOffset(from: number): number | null {
  const board = engine.dayBoard(from) as { wOff: number; index: number };
  const today = startOfDay(Date.now()).getTime();
  const weekAt = (off: number) => engine.weekModel(off) as { plan: Record<string, string>; dates: number[] };
  const laterIndex = (week: { plan: Record<string, string> }, after: number) =>
    Object.keys(week.plan)
      .map(Number)
      .filter((index) => index > after)
      .sort((a, b) => a - b)[0];
  const asOffset = (stamp: number) => Math.round((startOfDay(stamp).getTime() - today) / 86400000);
  const week = weekAt(board.wOff);
  const later = laterIndex(week, board.index);
  if (later != null && week.dates[later] != null) return asOffset(week.dates[later]);
  if (board.wOff !== 0) return null;
  const next = weekAt(1);
  const first = laterIndex(next, -1);
  if (first == null || next.dates[first] == null) return null;
  return asOffset(next.dates[first]);
}

function legSwap(): { activity: string; from: string; toId: string; to: string } | null {
  const board = engine.dayBoard(0) as { plannedId?: string | null; sessions: { k: string }[] };
  if (!board.plannedId) return null;
  const planned = (engine.DAYS as { id: string; title: string }[]).find((day) => day.id === board.plannedId);
  if (!planned || !/^Lower/.test(planned.title)) return null;
  if ((engine.wk.swapKeep || {})[engine.dayKey(Date.now())]) return null;
  const legs = board.sessions.find((session) => (engine.ACT[session.k]?.leg || 0) >= 1);
  if (!legs) return null;
  const week = engine.weekModel(0) as { todo?: string[] };
  const upper = (week.todo || []).find((id) =>
    /^Upper/.test((engine.DAYS as { id: string; title: string }[]).find((day) => day.id === id)?.title || ""),
  );
  if (!upper) return null;
  const title = (engine.DAYS as { id: string; title: string }[]).find((day) => day.id === upper)?.title || copy.workouts.lift;
  return { activity: activityName(legs.k), from: planned.title, toId: upper, to: title };
}

function SwapBanner({ onOpen }: { onOpen: (id: string) => void }) {
  "use no memo";
  useEngineStore((state) => state.version);
  const offer = legSwap();
  if (!offer) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{fill(copy.workouts.swapAsk, offer.activity, offer.from, offer.to)}</Text>
      <View style={styles.chips}>
        <Pressable accessibilityRole="button" onPress={() => onOpen(offer.toId)} style={styles.bannerOn}>
          <Text style={styles.bannerOnText}>{copy.workouts.swap}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            engine.wk.swapKeep = { ...(engine.wk.swapKeep || {}), [engine.dayKey(Date.now())]: 1 };
            engine.save();
          }}
          style={styles.ghostChip}
        >
          <Text style={styles.ghostChipText}>{copy.workouts.keepPlan}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OpenDay({ today, next, onJump }: { today: boolean; next: number | null; onJump: (offset: number) => void }) {
  const queued = today && Boolean(((engine.weekModel(0) as { todo?: string[] }).todo || [])[0]);
  return (
    <View style={[styles.liftCard, styles.liftCardPad, styles.openDay]}>
      <Text style={styles.liftEyebrow}>{queued ? copy.workouts.today : copy.workouts.openDay}</Text>
      <Text style={styles.liftTitle}>{copy.workouts.nothingPlanned}</Text>
      {next != null ? (
        <Pressable accessibilityRole="button" onPress={() => onJump(next)} style={styles.liftLink}>
          <Text style={styles.liftLinkText}>{copy.workouts.viewNext}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function openTitle(id: string): string {
  const day = (engine.DAYS as { id: string; title: string }[]).find((item) => item.id === id);
  return day?.title || copy.workouts.lift;
}

function previewRows(id: string): { name: string; detail: string }[] {
  const day = (engine.DAYS as any[]).find((item) => item.id === id);
  const plan = engine.plan();
  const planned = plan.days[id];
  if (!day || !planned) return [];
  return (engine.slotOrder(day) as number[])
    .filter((index) => !day.slots[index].cardio && !planned.slots[index]?.skip)
    .slice(0, 8)
    .map((index) => {
      const slot = day.slots[index];
      const target = planned.slots[index];
      const name = engine.exName(day, slot, index);
      const suggested = engine.suggest(day, slot, index, false, plan);
      const weight = suggested?.w ? (engine.isBW(name) ? "BW" : String(toDisplay(suggested.w))) : "";
      return { name, detail: `${target.sets} × ${slot.reps}${weight ? ` · ${weight}` : ""}` };
    });
}

function loggedDetail(row: { n: string; w?: number; r?: number; cardio?: number; min?: number }): string {
  if (row.cardio) return row.min ? copy.workouts.minutes(row.min) : copy.workouts.done;
  if (engine.isBW(row.n)) {
    const left = row.w && row.w > 0 ? fill(copy.workout.bwPlusShort, toDisplay(row.w)) : "BW";
    return `${left} × ${row.r}`;
  }
  return `${toDisplay(row.w || 0)} × ${row.r}`;
}

function LiftCards({
  offset,
  onOpen,
  onJump,
  onMoved,
}: {
  offset: number;
  onOpen: (id: string) => void;
  onJump: (offset: number) => void;
  onMoved: () => void;
}) {
  const [swapId, setSwapId] = useState<string | null>(null);
  const [swapAnchor, setSwapAnchor] = useState<SwapAnchor | null>(null);
  const board = engine.dayBoard(offset);
  const lifts = (board.sessions as { t: number; k: string; id?: string; title?: string; ex?: any[] }[]).filter(
    (session) => session.k === "lift",
  );
  return (
    <>
      {lifts.map((session) => {
        const day = (engine.DAYS as { id: string }[]).find((item) => item.id === session.id);
        const openable = !!(day && session.id && engine.wk.doneT?.[session.id] === session.t);
        const rows = (
          Array.isArray(session.ex) && session.ex.length
            ? session.ex
            : openable
              ? engine.daySummary(session.id)
              : []
        ) as { n: string }[];
        const shown = rows.slice(0, 6);
        const title = session.title || copy.workouts.lift;
        const body = (
          <>
            <Text style={styles.liftEyebrowMuted}>{copy.workouts.completed}</Text>
            <Text style={styles.liftTitle}>{title}</Text>
            {shown.length ? (
              shown.map((row) => (
                <View key={row.n} style={styles.previewRow}>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {row.n}
                  </Text>
                  <Text style={styles.previewDetail}>{loggedDetail(row as any)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.previewEmpty}>{copy.workouts.noneSaved}</Text>
            )}
            {rows.length > 6 ? <Text style={styles.previewEmpty}>{fill(copy.workouts.more, rows.length - 6)}</Text> : null}
          </>
        );
        if (!openable) {
          return (
            <View key={session.t} style={[styles.liftCard, styles.liftCardPad]}>
              {body}
            </View>
          );
        }
        return (
          <ShareBox key={session.t} tag={`lift-${session.id}`} style={styles.liftShare}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={title}
              onPress={() => session.id && onOpen(session.id)}
              style={({ pressed }) => [styles.liftCard, styles.liftCardPad, pressed && styles.liftPressed]}
            >
              {body}
            </Pressable>
          </ShareBox>
        );
      })}
      {!board.plannedId && !board.liftDone && !(board.sessions as unknown[]).length && !board.past ? (
        <OpenDay
          today={
            !!board.isToday &&
            ((engine.weekModel(0) as { todo?: string[] }).todo || []).length > 0
          }
          next={nextLiftOffset(offset)}
          onJump={onJump}
        />
      ) : null}
      {board.plannedId && !board.liftDone ? (
        <PlannedLift
          id={board.plannedId}
          today={board.isToday}
          thisWeek={board.wOff === 0}
          started={board.started}
          onOpen={onOpen}
          onMoved={onMoved}
          onSwap={(next) => {
            setSwapAnchor(next);
            setSwapId(board.plannedId);
          }}
        />
      ) : null}
      <SwapSheet
        id={swapId}
        anchor={swapAnchor}
        onClose={() => {
          setSwapId(null);
          setSwapAnchor(null);
        }}
      />
    </>
  );
}

function PlannedLift({
  id,
  today,
  thisWeek,
  started,
  onOpen,
  onMoved,
  onSwap,
}: {
  id: string;
  today: boolean;
  thisWeek: boolean;
  started: boolean;
  onOpen: (id: string) => void;
  onMoved: () => void;
  onSwap: (anchor: SwapAnchor) => void;
}) {
  const swapRef = useRef<any>(null);
  const title = openTitle(id);
  const rows = previewRows(id);
  const showSwap = canSwapDay(id);
  const body = (
    <>
      <View style={styles.liftTop}>
        <Text style={styles.liftEyebrow}>{today ? copy.workouts.today : copy.workouts.planned}</Text>
        {showSwap ? (
          <Pressable
            ref={swapRef}
            accessibilityRole="button"
            accessibilityLabel={`${copy.workouts.swap} ${title}`}
            onPress={() => {
              swapRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
                onSwap({ x, y, width, height });
              });
            }}
            style={styles.swapPill}
          >
            <Swap size={16} color={theme.text} />
            <Text style={styles.swapPillText}>{copy.workouts.swap}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.liftTitle}>{title}</Text>
      {rows.map((row) => (
        <View key={row.name} style={styles.previewRow}>
          <Text style={[styles.previewName, !today && styles.previewMuted]} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={styles.previewDetail}>{row.detail}</Text>
        </View>
      ))}
      {today ? (
        <>
          <Pressable accessibilityRole="button" onPress={() => onOpen(id)} style={styles.liftGo}>
            <Text style={styles.liftGoText}>{started ? copy.workouts.continue : copy.workouts.start}</Text>
          </Pressable>
        </>
      ) : thisWeek ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptic.medium();
            engine.moveLiftToToday(id);
            onMoved();
            useNotice.getState().show([fill(copy.workouts.moved, title)], { pulse: false });
          }}
          style={styles.liftMove}
        >
          <Text style={styles.liftMoveText}>{copy.workouts.move}</Text>
        </Pressable>
      ) : null}
    </>
  );
  if (!today) return <View style={[styles.liftCard, styles.liftCardPad]}>{body}</View>;
  return (
    <ShareBox tag={`lift-${id}`} style={[styles.liftCard, styles.liftCardPad]}>
      {body}
    </ShareBox>
  );
}

function ActivityCard({ session }: { session: ActSession }) {
  const name = activityName(session.k);
  const minutes = session.min ? copy.workouts.minutes(session.min) : "";
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: "/activity/[t]", params: { t: String(session.t) } })}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <Text style={styles.eyebrow}>{isRecent(session.t) ? copy.workouts.logged : copy.workouts.done}</Text>
      <View style={styles.cardRow}>
        <Text style={styles.cardName} numberOfLines={1}>
          {name}
        </Text>
        {minutes ? <Text style={styles.cardMinutes}>{minutes}</Text> : null}
      </View>
    </Pressable>
  );
}

function ActivityChips({
  offset,
  otherOpen,
  onToggle,
  onLog,
}: {
  offset: number;
  otherOpen: boolean;
  onToggle: () => void;
  onLog: (id: string, turnedOn: boolean) => void;
}) {
  "use no memo";
  useEngineStore((state) => state.version);
  if (!canLogDay(offset)) return null;
  const mine = chipIds();
  const others = otherIds();
  if (!mine.length && !others.length) return null;
  return (
    <View style={styles.log}>
      <View style={styles.chips}>
        {mine.map((id) => (
          <LogChip key={id} id={id} onPress={() => onLog(id, false)} />
        ))}
        {others.length ? (
          <Pressable
            style={({ pressed }) => [styles.otherChip, pressed && styles.pressed]}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={copy.workouts.other}
            accessibilityState={{ expanded: otherOpen }}
          >
            <Text style={styles.plus}>{otherOpen ? "−" : "+"}</Text>
            <Text style={styles.chipName}>{copy.workouts.other}</Text>
          </Pressable>
        ) : null}
      </View>
      {otherOpen ? (
        <View style={styles.chips}>
          {others.map((id) => (
            <LogChip key={id} id={id} onPress={() => onLog(id, true)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LogChip({ id, onPress }: { id: string; onPress: () => void }) {
  "use no memo";
  useEngineStore((state) => state.version);
  const name = activityName(id);
  const planned = plannedOf(id);
  const logged = loggedOf(id);
  const progress = planned > 0 ? copy.workouts.countOf(logged, planned) : logged > 0 ? String(logged) : "";
  return (
    <Pressable
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={progress ? `${name} ${progress}` : name}
    >
      <Text style={styles.plus}>+</Text>
      <Text style={styles.chipName}>{name}</Text>
      {progress ? <Text style={styles.chipCount}>{progress}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.green.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: theme.green.background,
  },
  title: {
    flex: 1,
    color: theme.text,
    fontFamily: theme.fonts.display,
    fontSize: 34,
    lineHeight: 36,
    textTransform: "uppercase",
  },
  today: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.green.accentFill,
    alignItems: "center",
    justifyContent: "center",
  },
  todayOff: {
    backgroundColor: theme.green.surface,
  },
  todayText: {
    color: theme.green.onAccent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
  todayTextOff: {
    color: theme.muted,
  },
  notice: {
    backgroundColor: theme.green.surface,
    borderRadius: theme.radii.tile,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  noticeTitle: {
    color: theme.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
  },
  noticeBody: {
    color: theme.muted,
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  weekArrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  weekArrowText: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 22,
  },
  dimmed: {
    opacity: 0.35,
  },
  cells: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
  },
  cell: {
    flex: 1,
    minHeight: 60,
    borderRadius: theme.radii.tile,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: theme.green.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 1,
  },
  cellPast: {
    backgroundColor: theme.green.background,
  },
  cellToday: {
    backgroundColor: theme.green.accentFill,
  },
  cellSelected: {
    borderColor: theme.green.accent,
  },
  cellLetter: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  cellLetterToday: {
    color: theme.green.onAccent,
  },
  cellDate: {
    color: theme.text,
    fontFamily: theme.fonts.monoMedium,
    fontSize: 14,
  },
  cellPastText: {
    color: theme.muted,
  },
  dots: {
    height: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dotLift: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.green.accent,
  },
  dotActivity: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.pink.accent,
  },
  dotUsual: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: theme.pink.accent,
  },
  dayLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayArrow: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.green.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dayArrowText: {
    color: theme.text,
    fontSize: 22,
    lineHeight: 24,
  },
  dayLabel: {
    flex: 1,
    textAlign: "center",
    color: theme.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
  },
  banner: {
    backgroundColor: theme.banner,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  bannerText: {
    color: theme.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  bannerChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.green.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerChipText: {
    color: theme.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
  ghostChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostChipText: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
  bannerOn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.green.accentFill,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerOnText: {
    color: "#fff",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
  openDay: {
    backgroundColor: "#24201d",
  },
  below: {
    gap: 14,
  },
  dayBody: {
    gap: 14,
  },
  fuel: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    borderRadius: theme.radii.card,
    backgroundColor: theme.green.surface,
    padding: 12,
  },
  fuelMain: { flex: 1.3, justifyContent: "center", gap: 2, minWidth: 0, paddingHorizontal: 4 },
  fuelLabel: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  fuelLine: { color: theme.text },
  fuelValue: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 22, lineHeight: 26 },
  fuelUnit: { color: theme.muted, fontFamily: theme.fonts.monoMedium, fontSize: 12 },
  fuelBit: {
    flex: 1,
    backgroundColor: theme.green.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
    justifyContent: "flex-start",
  },
  fuelBitLabel: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  fuelReady: { color: theme.green.accent, fontFamily: theme.fonts.bodySemi, fontSize: 16, lineHeight: 26 },
  fuelHours: { color: theme.fuel, fontFamily: theme.fonts.monoMedium, fontSize: 22, lineHeight: 26 },
  fuelHoursUnit: { color: theme.muted, fontFamily: theme.fonts.monoMedium, fontSize: 12 },
  cards: {
    gap: 10,
  },
  card: {
    backgroundColor: theme.pink.card,
    borderRadius: theme.radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  pressed: {
    opacity: 0.72,
  },
  eyebrow: {
    color: theme.pink.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  cardName: {
    flex: 1,
    color: theme.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 18,
  },
  cardMinutes: {
    color: theme.muted,
    fontFamily: theme.fonts.monoMedium,
    fontSize: 13,
  },
  liftShare: { alignSelf: "stretch" },
  liftPressed: { transform: [{ scale: 0.99 }] },
  liftCard: {
    backgroundColor: theme.green.surface,
    borderRadius: theme.radii.card,
  },
  liftCardPad: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  liftTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 32 },
  swapPill: {
    minHeight: 32,
    borderRadius: theme.radii.pill,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  swapPillText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  liftEyebrow: {
    color: theme.green.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
  },
  liftEyebrowMuted: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
  },
  liftTitle: {
    color: theme.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 18,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  previewName: {
    flex: 1,
    color: theme.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  previewMuted: {
    color: theme.muted,
  },
  previewDetail: {
    color: theme.muted,
    fontFamily: theme.fonts.mono,
    fontSize: 13,
  },
  previewEmpty: {
    color: theme.muted,
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  liftGo: {
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.green.accentFill,
    alignItems: "center",
    justifyContent: "center",
  },
  liftGoText: {
    color: "#fff",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
  },
  liftMove: {
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  liftMoveText: {
    color: theme.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
  },
  liftLink: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  liftLinkText: {
    color: theme.green.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
  },
  reminder: {
    backgroundColor: theme.pink.reminder,
    borderRadius: theme.radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  reminderText: {
    color: theme.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  rest: {
    backgroundColor: theme.green.surface,
    borderRadius: theme.radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  restEyebrow: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
  },
  restTitle: {
    color: theme.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 18,
  },
  log: {
    gap: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.pink.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  otherChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.pink.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  plus: {
    color: theme.pink.accent,
    fontFamily: theme.fonts.body,
    fontSize: 17,
    lineHeight: 20,
  },
  chipName: {
    color: theme.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
  chipCount: {
    color: theme.muted,
    fontFamily: theme.fonts.monoMedium,
    fontSize: 12,
  },
});
