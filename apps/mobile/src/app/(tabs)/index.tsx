"use no memo";

import { useFocusEffect } from "expo-router";
import { GlassSheet } from "@/components/glass-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  activityName,
  activitySessionsOn,
  addDays,
  answerYesterday,
  canLogDay,
  chipIds,
  dayBounds,
  dayLine,
  deleteSession,
  effortDescription,
  effortFor,
  heatedOn,
  isRecent,
  logActivity,
  logOther,
  addAskId,
  answerAddAsk,
  offsetForWeek,
  otherIds,
  saveSession,
  setSessionEffort,
  showReminder,
  showRest,
  spinIntensity,
  stampOn,
  startOfDay,
  stripFor,
  useNotice,
  usesSessionEffort,
  weekDays,
  weekOffset,
  yesterdayOpen,
  type ActSession,
} from "@/activity-log";
import { copy, fill } from "@/copy";
import { haptic } from "@/haptic";
import { openPlan, takeWorkoutsDay } from "@/links";
import { readPlan, usePlanClock } from "@/plan-model";
import { workoutUnderway } from "@/components/live-workout";
import { engine, useEngineStore } from "@/store";
import { TabBarSpacer } from "@/tab-bar-inset";
import { theme } from "@/theme";
import { toDisplay } from "@/units";
import { nativeDriver, useReduceMotion } from "@/use-reduce-motion";
import { useHideOnScroll, type HideOnScroll } from "@/use-hide-on-scroll";
import { SheetFrame } from "@/components/motion";
import { StepButton } from "@/components/step-button";
import { canSwapDay } from "@/components/swap-sheet";
import { TodayButton } from "@/components/today-button";
import { Swap } from "@/icons";
import { openFitSheet } from "@/form-sheet";
import { replaceWorkout, ShareBox, WorkoutLink } from "@/workout/share-box";

type DragSource = "day" | "week" | null;
type WindowSpan = { lo: number; hi: number; gen: number } | null;

function weekIndexFor(dayOffset: number, now = Date.now()): number {
  const today = startOfDay(now);
  return weekOffset(addDays(today, dayOffset), today);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function WorkoutsScreen() {
  const version = useEngineStore((state) => state.version);
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const hide = useHideOnScroll();
  const [dateSpace, setDateSpace] = useState(0);
  const dayScrollY = useRef<Record<number, number>>({});
  const [offset, setOffset] = useState(0);
  const [otherOpen, setOtherOpen] = useState(false);
  const [openSession, setOpenSession] = useState<number | null>(null);
  const [freshSession, setFreshSession] = useState<number | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [weekWidth, setWeekWidth] = useState(0);
  const [windowSpan, setWindowSpan] = useState<WindowSpan>(null);
  const offsetRef = useRef(0);
  const reduceRef = useRef(reduce);
  const boundsRef = useRef(dayBounds());
  const drag = useRef<DragSource>(null);
  const anchor = useRef(0);
  const motion = useRef<"control" | "idle">("idle");
  const placed = useRef(false);
  const prevDay = useRef(0);
  const prevWeek = useRef(0);
  const dayX = useRef(0);
  const weekX = useRef(0);
  const dayBoot = useRef<number | null>(null);
  const weekBoot = useRef<number | null>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowGen = useRef(0);
  const dayList = useRef<ScrollViewInstance>(null);
  const weekList = useRef<ScrollViewInstance>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const todayKey = startOfDay(Date.now()).toDateString();
  const bounds = useMemo(() => dayBounds(), [todayKey, version]);
  boundsRef.current = bounds;
  offsetRef.current = offset;
  reduceRef.current = reduce;

  const days = useMemo(() => {
    const list: number[] = [];
    for (let day = bounds.min; day <= bounds.max; day++) list.push(day);
    return list;
  }, [bounds.min, bounds.max]);
  const weeks = useMemo(() => {
    const list: number[] = [];
    for (let week = bounds.minWeek; week <= bounds.maxWeek; week++) list.push(week);
    return list;
  }, [bounds.minWeek, bounds.maxWeek]);

  function scrollDay(dayOffset: number, animated: boolean) {
    const width = pageWidth;
    if (width <= 0 || !dayList.current) return;
    const index = clamp(dayOffset, bounds.min, bounds.max) - bounds.min;
    const target = index * width;
    if (Math.abs(dayX.current - target) < 1) return;
    dayX.current = target;
    dayList.current.scrollTo({ x: target, y: 0, animated });
  }

  function scrollWeek(dayOffset: number, animated: boolean) {
    const width = weekWidth;
    if (width <= 0 || !weekList.current) return;
    const index = weekIndexFor(dayOffset) - bounds.minWeek;
    const target = index * width;
    if (Math.abs(weekX.current - target) < 1) return;
    weekX.current = target;
    weekList.current.scrollTo({ x: target, y: 0, animated });
  }

  function go(next: number) {
    const { min, max } = boundsRef.current;
    const clamped = clamp(next, min, max);
    const from = offsetRef.current;
    if (clamped === from) return;
    const delta = Math.abs(clamped - from);
    drag.current = null;
    motion.current = "control";
    if (delta > 1 && delta <= 3 && !reduceRef.current) {
      const gen = ++windowGen.current;
      setWindowSpan({ lo: Math.min(from, clamped), hi: Math.max(from, clamped), gen });
    } else {
      windowGen.current += 1;
      setWindowSpan(null);
    }
    offsetRef.current = clamped;
    setOffset(clamped);
    if (reduceRef.current) {
      fade.setValue(0.35);
      Animated.timing(fade, { toValue: 1, duration: 120, useNativeDriver: nativeDriver }).start();
    }
  }

  useLayoutEffect(() => {
    if (pageWidth <= 0 || weekWidth <= 0) return;
    const current = offsetRef.current;
    if (!placed.current) {
      dayX.current = Number.NaN;
      weekX.current = Number.NaN;
      scrollDay(current, false);
      scrollWeek(current, false);
      prevDay.current = current;
      prevWeek.current = weekIndexFor(current);
      placed.current = true;
      motion.current = "idle";
      return;
    }
    const dayDelta = Math.abs(current - prevDay.current);
    const nextWeek = weekIndexFor(current);
    const weekDelta = Math.abs(nextWeek - prevWeek.current);
    const animateDay =
      motion.current === "control" && drag.current == null && !reduce && dayDelta >= 1 && dayDelta <= 3;
    const animateWeek =
      !reduce && drag.current !== "week" && weekDelta === 1 && (motion.current === "control" || drag.current === "day");
    prevDay.current = current;
    prevWeek.current = nextWeek;
    if (drag.current !== "day") scrollDay(current, animateDay);
    if (drag.current !== "week") scrollWeek(current, animateWeek);
    motion.current = "idle";
  }, [offset, pageWidth, weekWidth, reduce, bounds.min, bounds.max, bounds.minWeek]);

  if (pageWidth > 0 && dayBoot.current == null) {
    dayBoot.current = (offsetRef.current - bounds.min) * pageWidth;
    dayX.current = dayBoot.current;
  }
  if (weekWidth > 0 && weekBoot.current == null) {
    weekBoot.current = (weekIndexFor(offsetRef.current) - bounds.minWeek) * weekWidth;
    weekX.current = weekBoot.current;
  }

  function onDayScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (drag.current !== "day" || pageWidth <= 0) return;
    dayX.current = event.nativeEvent.contentOffset.x;
    const index = clamp(Math.round(dayX.current / pageWidth), 0, days.length - 1);
    const next = bounds.min + index;
    if (next === offsetRef.current) return;
    offsetRef.current = next;
    setOffset(next);
    haptic.selection();
  }

  function onWeekScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (drag.current !== "week" || weekWidth <= 0) return;
    weekX.current = event.nativeEvent.contentOffset.x;
    const index = clamp(Math.round(weekX.current / weekWidth), 0, weeks.length - 1);
    const next = offsetForWeek(anchor.current, bounds.minWeek + index);
    if (next === offsetRef.current) return;
    offsetRef.current = next;
    setOffset(next);
    haptic.selection();
  }

  function clearDrag(source: Exclude<DragSource, null>) {
    if (releaseTimer.current) {
      clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    }
    if (drag.current === source) drag.current = null;
    if (source === "day") {
      setWindowSpan((current) => (current && current.gen === windowGen.current ? null : current));
    }
  }

  function endDrag(source: Exclude<DragSource, null>) {
    if (drag.current !== source) return;
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => {
      if (drag.current === source) drag.current = null;
    }, 450);
  }

  function endMomentum(source: Exclude<DragSource, null>, event: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = event.nativeEvent.contentOffset.x;
    if (source === "day") dayX.current = x;
    else weekX.current = x;
    clearDrag(source);
  }

  useEffect(() => {
    return () => {
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
    };
  }, []);

  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const y = dayScrollY.current[offset];
    if (y == null || y <= 1) hide.show();
  }, [hide.show, offset]);
  useFocusEffect(
    useCallback(() => {
      const next = takeWorkoutsDay();
      if (next != null) goRef.current(next);
    }, []),
  );

  const strip = stripFor(offset);

  function showDay(day: number) {
    if (Math.abs(day - offset) <= 1) return true;
    return windowSpan != null && day >= windowSpan.lo && day <= windowSpan.hi;
  }

  return (
    <View style={styles.screen}>
      <Reanimated.View
        pointerEvents="box-none"
        onLayout={hide.onHeaderLayout}
        style={[styles.chrome, { paddingTop: insets.top }, hide.chromeStyle]}
      >
      <Reanimated.View
        accessibilityElementsHidden={!hide.blocks}
        importantForAccessibility={hide.blocks ? "auto" : "no-hide-descendants"}
        pointerEvents={hide.blocks ? "auto" : "none"}
        style={hide.headerStyle}
      >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.liftBoard}
        </Text>
        <TodayButton today={offset === 0} onPress={() => go(0)} />
      </View>
      <View style={styles.stripWrap}>
        <View
          style={styles.weekWindow}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            setWeekWidth((prev) => (Math.abs(prev - width) < 0.5 ? prev : width));
          }}
        >
            {weekWidth > 0 ? (
              <ScrollView
                ref={weekList}
                contentOffset={{ x: weekBoot.current ?? 0, y: 0 }}
                horizontal
                bounces
                pagingEnabled
                snapToInterval={weekWidth}
                snapToAlignment="start"
                disableIntervalMomentum
                decelerationRate="fast"
                directionalLockEnabled
                nestedScrollEnabled
                overScrollMode="always"
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                scrollsToTop={false}
                style={styles.weekScroller}
                onScrollBeginDrag={() => {
                  drag.current = "week";
                  anchor.current = offsetRef.current;
                }}
                onScroll={onWeekScroll}
                onScrollEndDrag={() => endDrag("week")}
                onMomentumScrollEnd={(event) => endMomentum("week", event)}
              >
                {weeks.map((week) => (
                  <View key={week} style={[styles.weekPage, { width: weekWidth }]}>
                    {weekDays(week, offset).map((day) => (
                      <PressableScale
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
                        <Text
                          style={[
                            styles.cellDate,
                            day.today && styles.cellLetterToday,
                            day.past && !day.selected && styles.cellPastText,
                          ]}
                        >
                          {day.date.getDate()}
                        </Text>
                        <View style={styles.dots}>
                          {day.lift ? <View style={styles.dotLift} /> : day.planned ? <View style={styles.dotPlanned} /> : null}
                          {day.activity ? <View style={styles.dotActivity} /> : null}
                          {day.usual ? <View style={styles.dotUsual} /> : null}
                        </View>
                      </PressableScale>
                    ))}
                  </View>
                ))}
              </ScrollView>
            ) : null}
        </View>
      </View>
      </Reanimated.View>
      </Reanimated.View>
      <Reanimated.View
        style={[styles.dayLine, hide.dockStyle]}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.height;
          setDateSpace((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
        }}
      >
        <StepButton
          glyph="‹"
          label={copy.workouts.previousDay}
          disabled={!strip.canPrevDay}
          reduce={reduce}
          surface={theme.green.surface}
          hot={theme.green.accent}
          ink={theme.green.background}
          onPress={() => go(offset - 1)}
        />
        <Text style={styles.dayLabel}>{dayLine(offset)}</Text>
        <StepButton
          glyph="›"
          label={copy.workouts.nextDay}
          disabled={!strip.canNextDay}
          reduce={reduce}
          surface={theme.green.surface}
          hot={theme.green.accent}
          ink={theme.green.background}
          onPress={() => go(offset + 1)}
        />
      </Reanimated.View>
      <Animated.View
        style={[styles.pager, reduce ? { opacity: fade } : null]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setPageWidth((prev) => (Math.abs(prev - width) < 0.5 ? prev : width));
          setPageHeight((prev) => (Math.abs(prev - height) < 0.5 ? prev : height));
        }}
      >
        {pageWidth > 0 && pageHeight > 0 ? (
          <ScrollView
            ref={dayList}
            contentOffset={{ x: dayBoot.current ?? 0, y: 0 }}
            horizontal
            bounces
            pagingEnabled
            snapToInterval={pageWidth}
            snapToAlignment="start"
            disableIntervalMomentum
            decelerationRate="fast"
            directionalLockEnabled
            nestedScrollEnabled
            overScrollMode="always"
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            scrollsToTop={false}
            style={styles.pager}
            onScrollBeginDrag={() => {
              drag.current = "day";
            }}
            onScroll={onDayScroll}
            onScrollEndDrag={() => endDrag("day")}
            onMomentumScrollEnd={(event) => endMomentum("day", event)}
          >
            {days.map((day) => (
              <View
                key={day}
                style={{ width: pageWidth, height: pageHeight }}
                accessibilityElementsHidden={day !== offset}
                importantForAccessibility={day === offset ? "auto" : "no-hide-descendants"}
              >
                {showDay(day) ? (
                  <DayPage
                    offset={day}
                    otherOpen={otherOpen && day === offset}
                    openSession={openSession}
                    freshSession={freshSession}
                    onLogged={(at) => {
                      setFreshSession(at);
                      setTimeout(() => {
                        const offer = legSwap();
                        if (!offer) return;
                        engine.wk.swapKeep = { ...(engine.wk.swapKeep || {}), [engine.dayKey(Date.now())]: 1 };
                        engine.save();
                        openFitSheet({
                          kind: "leg",
                          offer,
                          onSwap: (id, title) => {
                            engine.moveLiftToToday(id);
                            go(0);
                            useNotice.getState().show([fill(copy.workouts.moved, title)], { pulse: false });
                          },
                        });
                      }, 500);
                    }}
                    onToggleOther={() => setOtherOpen((open) => !open)}
                    onCloseOther={() => setOtherOpen(false)}
                    onOpenSession={setOpenSession}
                    onToggleSession={(t) => setOpenSession((current) => (current === t ? null : t))}
                    onJump={go}
                    onMoved={() => go(0)}
                    hide={hide}
                    topInset={hide.space + dateSpace}
                    scrollsToTop={day === offset}
                    onScrollSettled={(y) => {
                      dayScrollY.current[day] = y;
                    }}
                  />
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </Animated.View>
    </View>
  );
}

function DayPage({
  offset,
  otherOpen,
  openSession,
  freshSession,
  onLogged,
  onToggleOther,
  onCloseOther,
  onOpenSession,
  onToggleSession,
  onJump,
  onMoved,
  hide,
  topInset,
  scrollsToTop,
  onScrollSettled,
}: {
  offset: number;
  otherOpen: boolean;
  openSession: number | null;
  freshSession: number | null;
  onLogged: (at: number) => void;
  onToggleOther: () => void;
  onCloseOther: () => void;
  onOpenSession: (t: number) => void;
  onToggleSession: (t: number) => void;
  onJump: (offset: number) => void;
  onMoved: () => void;
  hide: HideOnScroll;
  topInset: number;
  scrollsToTop: boolean;
  onScrollSettled: (y: number) => void;
}) {
  const reduce = useReduceMotion();
  const page = useRef<ScrollViewInstance>(null);
  const pageY = useRef(0);
  const pageH = useRef(0);
  const date = addDays(startOfDay(Date.now()), offset);
  const activities = activitySessionsOn(date);

  function showCard(node: { measureLayout: (relative: object, success: (x: number, y: number, width: number, height: number) => void, fail: () => void) => void }) {
    const scroller = page.current;
    if (!scroller) return;
    node.measureLayout(
      scroller,
      (_x, y, _width, height) => {
        const overflow = y + height + 24 - (pageY.current + pageH.current);
        if (overflow > 8) scroller.scrollTo({ y: pageY.current + overflow, animated: !reduce });
      },
      () => {},
    );
  }

  function logOnDay(id: string, turnedOn: boolean) {
    const at = stampOn(date, offset === 0);
    if (turnedOn) {
      logOther(id, at);
      onCloseOther();
      useNotice.getState().show([copy.workouts.loggedToast(activityName(id)), copy.workouts.added]);
    } else {
      logActivity(id, at);
    }
    onOpenSession(at);
    onLogged(at);
  }

  return (
    <Reanimated.ScrollView
      ref={page}
      style={styles.dayScroll}
      onLayout={(event) => {
        pageH.current = event.nativeEvent.layout.height;
      }}
      contentContainerStyle={[styles.dayContent, { paddingTop: 14 + topInset }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      directionalLockEnabled
      nestedScrollEnabled
      alwaysBounceVertical={false}
        onScroll={(event) => {
          pageY.current = event.nativeEvent.contentOffset.y;
          hide.onScroll(event);
        }}
      scrollEventThrottle={16}
      scrollsToTop={scrollsToTop}
      contentInsetAdjustmentBehavior="never"
      onScrollEndDrag={(event) => onScrollSettled(event.nativeEvent.contentOffset.y)}
      onMomentumScrollEnd={(event) => onScrollSettled(event.nativeEvent.contentOffset.y)}
    >
      {offset === 0 ? <YesterdayBanner /> : null}
      <View style={styles.cards}>
        <LiftCards
          offset={offset}
          onJump={onJump}
          onMoved={onMoved}
        />
        {activities.map((session) => (
          <ActivityCard
            key={session.t}
            session={session}
            open={openSession === session.t}
            fresh={freshSession === session.t}
            onShow={showCard}
            onToggle={() => onToggleSession(session.t)}
          />
        ))}
        {offset === 0 ? <AddWeeklyAsk /> : null}
        {showReminder(offset) ? (
          <View style={styles.reminder}>
            <Text style={styles.eyebrow}>{copy.workouts.activityDay}</Text>
            <Text style={styles.reminderText}>{offset === 0 ? copy.workouts.logBelow : copy.workouts.usually}</Text>
          </View>
        ) : null}
        {showRest(offset) ? (
          <View style={styles.rest}>
            <Text style={styles.restEyebrow}>{copy.workouts.rest}</Text>
            <Text style={styles.restTitle}>{copy.workouts.nothingLogged}</Text>
          </View>
        ) : null}
      </View>
      <ActivityChips offset={offset} otherOpen={otherOpen} onToggle={onToggleOther} onLog={logOnDay} />
      {offset === 0 ? <FuelLink /> : null}
      <TabBarSpacer />
    </Reanimated.ScrollView>
  );
}

/** After logging past the weekly sessions: offer to make it a weekly session. Small, inline, asked once a week. */
function AddWeeklyAsk() {
  useEngineStore((state) => state.version);
  const id = addAskId();
  if (!id) return null;
  return (
    <View style={styles.reminder}>
      <Text style={styles.reminderText}>{copy.workouts.addAsk(activityName(id))}</Text>
      <View style={styles.askRow}>
        <PressableScale
          accessibilityRole="button"
          onPress={() => {
            haptic.selection();
            answerAddAsk(id, true);
          }}
          style={styles.askYes}
        >
          <Text style={styles.askYesText}>{copy.workouts.addYes}</Text>
        </PressableScale>
        <PressableScale kind="text" accessibilityRole="button" onPress={() => answerAddAsk(id, false)} style={styles.askNo}>
          <Text style={styles.askNoText}>{copy.workouts.addNo}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function FuelLink() {
  const version = useEngineStore((state) => state.version);
  const clock = usePlanClock();
  const model = useMemo(() => readPlan(), [version, clock]);
  if (!engine.wk.setupDone) return null;
  return (
    <PressableScale
      kind="surface"
      accessibilityRole="button"
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
    </PressableScale>
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
  useEngineStore((state) => state.version);
  const open = yesterdayOpen();
  if (!open) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{copy.workouts.yesterday}</Text>
      <View style={styles.chips}>
        {open.map((id) => (
          <PressableScale
            key={id}
            style={styles.bannerChip}
            onPress={() => answerYesterday(id)}
            accessibilityRole="button"
          >
            <Text style={styles.bannerChipText}>{activityName(id)}</Text>
          </PressableScale>
        ))}
        <PressableScale style={styles.ghostChip} onPress={() => answerYesterday(null)} accessibilityRole="button">
          <Text style={styles.ghostChipText}>{copy.workouts.no}</Text>
        </PressableScale>
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
  if (board.sessions.some((session) => session.k === "lift")) return null;
  const week = engine.weekModel(0) as { todo?: string[] };
  const upper = (week.todo || []).find((id) =>
    /^Upper/.test((engine.DAYS as { id: string; title: string }[]).find((day) => day.id === id)?.title || ""),
  );
  if (!upper) return null;
  const title = (engine.DAYS as { id: string; title: string }[]).find((day) => day.id === upper)?.title || copy.workouts.lift;
  return { activity: activityName(legs.k), from: planned.title, toId: upper, to: title };
}

function OpenDay({ today, next, onJump }: { today: boolean; next: number | null; onJump: (offset: number) => void }) {
  const queued = today && Boolean(((engine.weekModel(0) as { todo?: string[] }).todo || [])[0]);
  return (
    <View style={[styles.liftCard, styles.liftCardPad, styles.openDay]}>
      <Text style={styles.liftEyebrow}>{queued ? copy.workouts.today : copy.workouts.openDay}</Text>
      <Text style={styles.liftTitle}>{copy.workouts.nothingPlanned}</Text>
      {next != null ? (
        <PressableScale kind="text" accessibilityRole="button" onPress={() => onJump(next)} style={styles.liftLink}>
          <Text style={styles.liftLinkText}>{copy.workouts.viewNext}</Text>
        </PressableScale>
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
      return { name, detail: `${target.sets} × ${slot.reps}${weight ? ` (${weight})` : ""}` };
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
  onJump,
  onMoved,
}: {
  offset: number;
  onJump: (offset: number) => void;
  onMoved: () => void;
}) {
  useEngineStore((state) => state.version);
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
            <WorkoutLink id={session.id || ""} style={[styles.liftCard, styles.liftCardPad]}>
              {body}
            </WorkoutLink>
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
          started={workoutUnderway(board.plannedId)}
          onMoved={onMoved}
          onSwap={() => {
            const cur = board.plannedId!;
            openFitSheet({
              kind: "swap",
              id: cur,
              onWorkout: (nextId) => {
                if (workoutUnderway(cur)) replaceWorkout(nextId);
              },
            });
          }}
        />
      ) : null}
    </>
  );
}

function PlannedLift({
  id,
  today,
  thisWeek,
  started,
  onMoved,
  onSwap,
}: {
  id: string;
  today: boolean;
  thisWeek: boolean;
  started: boolean;
  onMoved: () => void;
  onSwap: () => void;
}) {
  const title = openTitle(id);
  const rows = previewRows(id);
  const swap = canSwapDay(id) ? (
    <PressableScale
      kind="button"
      accessibilityRole="button"
      accessibilityLabel={`${copy.workouts.swap} ${title}`}
      onPress={onSwap}
      style={[styles.swapPill, today ? styles.swapOver : null]}
    >
      <Swap size={16} color={theme.text} />
      <Text style={styles.swapPillText}>{copy.workouts.swap}</Text>
    </PressableScale>
  ) : null;
  const body = (
    <>
      <View style={styles.liftTop}>
        <Text style={styles.liftEyebrow}>{today ? copy.workouts.today : copy.workouts.planned}</Text>
        {today ? null : swap}
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
          <View style={styles.liftGo}>
            <Text style={styles.liftGoText}>{started ? copy.workouts.continue : copy.workouts.start}</Text>
          </View>
        </>
      ) : thisWeek ? (
        <PressableScale
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
        </PressableScale>
      ) : null}
    </>
  );
  if (!today) return <View style={[styles.liftCard, styles.liftCardPad]}>{body}</View>;
  return (
    <ShareBox tag={`lift-${id}`} style={styles.liftShare}>
      <WorkoutLink id={id} style={[styles.liftCard, styles.liftCardPad]}>
        {body}
      </WorkoutLink>
      {/* Outside the link: on iOS the zoom trigger takes every touch inside it. */}
      {swap}
    </ShareBox>
  );
}

function ActivityCard({
  session,
  open,
  fresh,
  onShow,
  onToggle,
}: {
  session: ActSession;
  open: boolean;
  fresh: boolean;
  onShow: (node: { measureLayout: (relative: object, success: (x: number, y: number, width: number, height: number) => void, fail: () => void) => void }) => void;
  onToggle: () => void;
}) {
  const reduce = useReduceMotion();
  const name = activityName(session.k);
  const minutes = session.min ? copy.workouts.minutes(session.min) : "";
  const grow = open && fresh && !reduce;
  const [full, setFull] = useState(0);
  const height = useSharedValue(0);
  const fade = useSharedValue(grow ? 0 : 1);
  useEffect(() => {
    if (!grow || !full) {
      height.value = full;
      fade.value = 1;
      return;
    }
    height.value = 0;
    fade.value = 0;
    height.value = withTiming(full, { duration: 320, easing: Easing.out(Easing.cubic) });
    fade.value = withDelay(140, withTiming(1, { duration: 180 }));
  }, [fade, fresh, full, grow, height]);
  const card = useRef<{ measureLayout: (relative: object, success: (x: number, y: number, width: number, height: number) => void, fail: () => void) => void } | null>(null);
  useEffect(() => {
    if (!fresh || !open) return;
    const timer = setTimeout(() => {
      if (card.current) onShow(card.current);
    }, reduce ? 0 : 340);
    return () => clearTimeout(timer);
  }, [fresh, onShow, open, reduce]);
  const grown = useAnimatedStyle(() => ({
    height: full ? height.value : undefined,
    overflow: "hidden",
  }));
  const risen = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: (1 - fade.value) * 8 }],
  }));
  return (
    <View ref={card as never} style={styles.card}>
      <PressableScale
        kind="surface"
        style={styles.cardHit}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.eyebrow}>{isRecent(session.t) ? copy.workouts.logged : copy.workouts.done}</Text>
        <View style={styles.cardRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {name}
          </Text>
          {minutes ? <Text style={styles.cardMinutes}>{minutes}</Text> : null}
        </View>
      </PressableScale>
      {open ? (
        grow ? (
          <Reanimated.View style={grown}>
            <Reanimated.View style={risen} onLayout={(event) => setFull(event.nativeEvent.layout.height)}>
              <ActivityDetails session={session} onClose={onToggle} />
            </Reanimated.View>
          </Reanimated.View>
        ) : (
          <ActivityDetails session={session} onClose={onToggle} />
        )
      ) : null}
    </View>
  );
}

function ActivityDetails({ session, onClose }: { session: ActSession; onClose: () => void }) {
  const name = activityName(session.k);
  const generic = usesSessionEffort(session.k);
  const showIntensity = session.k === "spin";
  const showClass = session.k === "yoga" || session.k === "pilates";
  const showHeated = session.k === "yoga";
  const [minutes, setMinutes] = useState(session.min ? String(session.min) : "");
  const [effort, setEffort] = useState(generic ? session.eff || "Moderate" : effortFor(session.k));
  const [intensity, setIntensity] = useState(spinIntensity);
  const [heated, setHeated] = useState(heatedOn);
  const [askDelete, setAskDelete] = useState(false);
  const gone = useRef(false);
  const insets = useSafeAreaInsets();

  function commit(next: { minutes?: string; effort?: string; intensity?: string; heated?: boolean }) {
    if (gone.current) return;
    const minutesValue = next.minutes ?? minutes;
    const effortValue = next.effort ?? effort;
    saveSession(session.t, {
      minutes: minutesValue,
      effort: generic || showClass ? effortValue : undefined,
      intensity: showIntensity ? (next.intensity ?? intensity) : undefined,
      heated: showHeated ? (next.heated ?? heated) : undefined,
    });
  }

  function confirmDelete() {
    gone.current = true;
    haptic.warning();
    setAskDelete(false);
    deleteSession(session.t);
    useNotice.getState().show([copy.workouts.deletedToast(name)], { pulse: false });
    onClose();
  }

  return (
    <View style={styles.details}>
      <Text style={styles.eyebrow}>{copy.workouts.minutesDone}</Text>
      <TextInput
        value={minutes}
        onChangeText={(value) => setMinutes(value.replace(/[^\d]/g, "").slice(0, 4))}
        onBlur={() => commit({ minutes })}
        onSubmitEditing={() => commit({ minutes })}
        keyboardType="number-pad"
        inputMode="numeric"
        accessibilityLabel={copy.workouts.minutesDone}
        style={styles.detailInput}
        selectionColor={theme.pink.accent}
      />
      {showIntensity ? (
        <ChoiceRow
          label={copy.activities.intensity}
          value={intensity}
          options={[
            { value: copy.activities.hard, label: copy.activities.hard },
            { value: copy.activities.reallyHard, label: copy.activities.reallyHard },
          ]}
          onChange={(value) => {
            setIntensity(value);
            commit({ intensity: value });
          }}
        />
      ) : null}
      {showClass ? (
        <View style={styles.detailBlock}>
          <ChoiceRow
            label={copy.activities.effort}
            value={effort}
            options={[
              { value: copy.activities.light, label: copy.activities.light },
              { value: copy.activities.moderate, label: copy.activities.moderate },
              { value: copy.activities.hard, label: copy.activities.hard },
            ]}
            onChange={(value) => {
              setEffort(value);
              commit({ effort: value });
            }}
          />
          <Text style={styles.detailNote}>{effortDescription(session.k, effort)}</Text>
        </View>
      ) : null}
      {generic ? (
        <ChoiceRow
          label={copy.workouts.howHard}
          value={effort}
          options={[
            { value: "Easy", label: copy.workouts.easy },
            { value: "Moderate", label: copy.activities.moderate },
            { value: "Hard", label: copy.activities.hard },
          ]}
          onChange={(value) => {
            setEffort(value);
            setSessionEffort(session.t, value);
          }}
        />
      ) : null}
      {showHeated ? (
        <View style={styles.heatedRow}>
          <Text style={styles.detailLabel}>{copy.activities.heated}</Text>
          <View style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel={copy.activities.heated}>
            <PressableScale
              style={[styles.segment, !heated && styles.segmentOn]}
              onPress={() => {
                if (heated) {
                  haptic.selection();
                  setHeated(false);
                  commit({ heated: false });
                }
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: !heated }}
            >
              <Text style={[styles.segmentText, !heated && styles.segmentTextOn]}>{copy.activities.notHeated}</Text>
            </PressableScale>
            <PressableScale
              style={[styles.segment, heated && styles.segmentOn]}
              onPress={() => {
                if (!heated) {
                  haptic.selection();
                  setHeated(true);
                  commit({ heated: true });
                }
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: heated }}
            >
              <Text style={[styles.segmentText, heated && styles.segmentTextOn]}>{copy.activities.heated}</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
      <PressableScale
        style={styles.deleteButton}
        onPress={() => setAskDelete(true)}
        accessibilityRole="button"
      >
        <Text style={styles.deleteText}>{copy.workouts.delete}</Text>
      </PressableScale>
      <SheetFrame visible={askDelete} onClose={() => setAskDelete(false)} label={copy.you.cancel}>
        <GlassSheet style={[styles.sheet, { marginBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetButtons}>
            <PressableScale accessibilityRole="button" onPress={() => setAskDelete(false)} style={styles.sheetCancel}>
              <Text style={styles.sheetCancelText}>{copy.you.cancel}</Text>
            </PressableScale>
            <PressableScale accessibilityRole="button" onPress={confirmDelete} style={styles.sheetDelete}>
              <Text style={styles.sheetDeleteText}>{copy.workouts.delete}</Text>
            </PressableScale>
          </View>
        </GlassSheet>
      </SheetFrame>
    </View>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.detailBlock} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.pills}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <PressableScale
              key={option.value}
              style={[styles.pill, selected && styles.pillOn]}
              onPress={() => {
                if (!selected) haptic.selection();
                onChange(option.value);
              }}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
            >
              <Text style={[styles.pillText, selected && styles.pillTextOn]}>{option.label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
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
          <PressableScale
            style={styles.otherChip}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={copy.workouts.other}
            accessibilityState={{ expanded: otherOpen }}
          >
            <Text style={styles.plus}>{otherOpen ? "−" : "+"}</Text>
            <Text style={styles.chipName}>{copy.workouts.other}</Text>
          </PressableScale>
        ) : null}
      </View>
      {otherOpen ? (
        <View style={styles.chips}>
          {others.map((id) => (
            <LogChip key={id} id={id} onPress={() => onLog(id, !engine.enabled(id))} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LogChip({ id, onPress }: { id: string; onPress: () => void }) {
  useEngineStore((state) => state.version);
  const name = activityName(id);
  return (
    <PressableScale style={styles.chip} onPress={onPress} accessibilityRole="button" accessibilityLabel={name}>
      <Text style={styles.plus}>+</Text>
      <Text style={styles.chipName}>{name}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.green.background,
  },
  chrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: theme.green.background,
  },
  stripWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  weekWindow: {
    height: 64,
    overflow: "hidden",
  },
  weekScroller: {
    height: 64,
  },
  weekPage: {
    height: 64,
    flexDirection: "row",
    gap: 4,
  },
  pager: {
    flex: 1,
    overflow: "hidden",
  },
  dayScroll: {
    flex: 1,
  },
  dayContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
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
  dimmed: {
    opacity: 0.35,
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
  dotPlanned: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: theme.green.accent,
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
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
    backgroundColor: theme.green.background,
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
  cardHit: {
    minHeight: 44,
    gap: 8,
    justifyContent: "center",
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
  details: {
    gap: 10,
    paddingTop: 4,
  },
  detailBlock: {
    gap: 8,
  },
  detailLabel: {
    color: theme.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
    lineHeight: 20,
  },
  detailInput: {
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.pink.input,
    color: theme.text,
    fontFamily: theme.fonts.monoMedium,
    fontSize: 18,
    paddingHorizontal: 12,
  },
  detailNote: {
    color: theme.muted,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
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
  heatedRow: {
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
  deleteButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    color: theme.pink.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 16,
  },
  sheet: {
    marginHorizontal: 12,
    backgroundColor: theme.pink.surface,
    borderRadius: 24,
    padding: 16,
    gap: 16,
  },
  sheetTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 20 },
  swapBody: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 21 },
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
  swapOver: { position: "absolute", top: 14, right: 16 },
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
  askRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  askYes: {
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.pink.selectedFill,
    alignItems: "center",
    justifyContent: "center",
  },
  askYesText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 14 },
  askNo: { minHeight: 40, paddingHorizontal: 12, justifyContent: "center" },
  askNoText: { color: theme.muted, fontFamily: theme.fonts.bodySemi, fontSize: 14 },
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
});
