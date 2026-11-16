import { router, useFocusEffect } from "expo-router";
import { PressableScale } from "@/components/pressable-scale";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Keyboard, StyleSheet, type ScrollViewInstance, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useNotice } from "@/activity-log";
import { LiveWorkoutBar } from "@/components/live-workout";
import { avgWeightDial, DialValue, shareDial } from "@/components/number-dial";
import {
  ChoicePills,
  ConfirmCard,
  DayPicker,
  Eyebrow,
  StatusMark,
  ToggleRow,
  fieldLabelStyle,
  noteStyle,
  panelStyle,
  planColors,
} from "@/components/plan-widgets";
import { copy, fill } from "@/copy";
import { Edit } from "@/icons";
import { subscribePlanView, takePlanView } from "@/links";
import { openWorkout } from "@/workout/share-box";
import {
  fitPace,
  migratePace,
  paceFromDial,
  readPlan,
  usePlanClock,
  weightForInput,
  weightForStore,
  type PlanPart,
  type PlanRead,
  type PlanRow,
} from "@/plan-model";
import { storage } from "@/storage";
import { TabBarSpacer, TabScrollMarker } from "@/tab-bar-inset";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { useReduceMotion } from "@/use-reduce-motion";
import { useHideOnScroll, type HideOnScroll } from "@/use-hide-on-scroll";

const VIEW_KEY = "liftboard.v1.pv";

type ViewName = "week" | "season";
type CheckKey = "ready" | "sore" | "cycle" | "drink";

type Actions = {
  setCheck: (key: CheckKey, value: string) => void;
  commitWeight: (text: string) => void;
  saveCheckIn: (text: string) => void;
  editCheckIn: () => void;
  toggleLift: (index: number) => void;
  toggleActivity: (index: number) => void;
  addWeekly: (id: string) => void;
  setSeason: (on: boolean) => void;
  setRamp: (on: boolean) => void;
  setDeload: (on: boolean) => void;
  setGoal: (value: string) => void;
  setPace: (value: string) => void;
  setFocus: (value: string) => void;
  commitShare: (text: string) => void;
  openRow: (row: PlanRow) => void;
  setSession: (minutes: number) => void;
  show: (lines: string[], pulse?: boolean) => void;
  undoFinish: () => void;
};

function savedView(): ViewName {
  return storage.getItem(VIEW_KEY) === "season" ? "season" : "week";
}

export default function PlanScreen() {
  "use no memo";
  const version = useEngineStore((state) => state.version);
  const clock = usePlanClock();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const hide = useHideOnScroll();
  const model = useMemo(() => readPlan(), [version, clock]);
  const { width } = useWindowDimensions();
  const [view, setView] = useState<ViewName>(savedView);
  const [pendingSeason, setPendingSeason] = useState<"In-season" | "Off-season" | null>(null);
  const [pendingFinish, setPendingFinish] = useState(false);
  const weekScroll = useRef<ScrollViewInstance>(null);
  const progress = useSharedValue(view === "season" ? 1 : 0);
  const pageW = useSharedValue(width);
  const weekOpacity = useSharedValue(view === "week" ? 1 : 0);
  const seasonOpacity = useSharedValue(view === "season" ? 1 : 0);

  useEffect(() => {
    pageW.value = width;
  }, [pageW, width]);

  useEffect(() => {
    if (migratePace()) engine.save();
  }, []);

  function show(lines: string[], pulse = true) {
    if (!lines.length) return;
    useNotice.getState().show(lines, { pulse, variant: "plan" });
  }

  function commit(mutate: () => void) {
    const before = engine.fx(engine.plan());
    mutate();
    engine.save();
    const after = engine.fx(engine.plan());
    const cap = engine.wk.guide === "Less" ? 2 : 5;
    return (engine.diffFx(before, after) as string[]).slice(0, cap);
  }

  function commitToast(mutate: () => void, pulse = true) {
    const lines = commit(mutate);
    if (lines.length) show(lines, pulse);
  }

  function applySeason(next: "In-season" | "Off-season") {
    commitToast(() => {
      engine.wk.season = next;
      engine.wk.days = next === "In-season" ? 2 : 3;
      engine.wk.done = {};
      engine.wk.donePlan = {};
      engine.wk.upNext = "";
      engine.wk.missedNote = null;
    }, false);
  }

  const actions: Actions = {
    setCheck(key, value) {
      if (engine.wk[key] === value) return;
      commitToast(() => {
        engine.wk[key] = value;
      }, false);
    },
    commitWeight(text) {
      const stored = weightForStore(text);
      if (String(engine.wk.wAvg ?? "") === stored) return;
      commitToast(() => {
        engine.wk.wAvg = stored;
      });
    },
    saveCheckIn(text) {
      Keyboard.dismiss();
      engine.wk.wAvg = weightForStore(text);
      engine.wk.ckDone = true;
      engine.save();
      show([copy.plan.checkInSaved, copy.plan.planIsSet]);
    },
    editCheckIn() {
      engine.wk.ckDone = false;
      engine.save();
      requestAnimationFrame(() => {
        weekScroll.current?.scrollTo({ y: 0, animated: !reduceMotion });
      });
    },
    setSession(minutes) {
      if (Number(engine.wk.time) === minutes) return;
      commitToast(() => {
        engine.wk.time = minutes;
        engine.syncDays();
      }, false);
    },
    toggleLift(index) {
      const current: number[] = model.liftDays;
      const on = current.includes(index);
      const next = on ? current.filter((day) => day !== index) : [...current, index].sort((a, b) => a - b);
      if (!on && engine.inSeason() && next.length > 3) {
        show([copy.plan.inSeason, copy.plan.liftDayCap], false);
        return;
      }
      commitToast(() => {
        engine.wk.ldays = next;
        engine.wk.days = next.length;
        engine.syncDays();
      }, false);
    },
    toggleActivity(index) {
      engine.setActivityDay(index, !model.activityDays.includes(index));
      engine.save();
    },
    addWeekly(id) {
      engine.addWeekly(id);
    },
    setSeason(on) {
      const next = on ? "In-season" : "Off-season";
      if (engine.wk.season === next) return;
      if (Object.keys(engine.wk.done || {}).length) {
        setPendingSeason(next);
        return;
      }
      applySeason(next);
    },
    setRamp(on) {
      const value = on ? "Yes" : "No";
      if (value === "Yes") {
        commit(() => {
          engine.wk.ramp = value;
        });
        show([copy.plan.preSeasonRamp, copy.plan.zone2Added], false);
        return;
      }
      commitToast(() => {
        engine.wk.ramp = value;
      }, false);
    },
    setDeload(on) {
      commitToast(() => {
        engine.wk.deload = on ? "Yes" : "No";
      }, false);
    },
    setGoal(value) {
      if (engine.wk.mode === value) return;
      commitToast(() => {
        engine.wk.mode = value;
        fitPace();
      }, false);
    },
    setPace(value) {
      const next = paceFromDial(value);
      if (next == null) return;
      commitToast(() => {
        engine.wk.ratePct = next;
      });
    },
    setFocus(value) {
      if (engine.wk.focus === value) return;
      commitToast(() => {
        engine.wk.focus = value;
      }, false);
    },
    undoFinish() {
      if (!engine.undoFinish()) return;
      show([copy.plan.weekReopened]);
    },
    commitShare(text) {
      const value = text.trim();
      if (String(engine.wk.share ?? "") === value) return;
      commitToast(() => {
        engine.wk.share = value;
      });
    },
    openRow(row) {
      if (row.kind === "lift") {
        openWorkout(row.id, "plain");
        return;
      }
      if (row.openedAt != null) {
        router.push({ pathname: "/activity/[t]", params: { t: String(row.openedAt) } });
      }
    },
    show,
  };

  const goRef = useRef<(next: ViewName) => void>(() => {});

  function go(next: ViewName) {
    if (next === view) return;
    hide.show();
    storage.setItem(VIEW_KEY, next);
    setView(next);
    if (reduceMotion) {
      weekOpacity.value = withTiming(next === "week" ? 1 : 0, { duration: 150 });
      seasonOpacity.value = withTiming(next === "season" ? 1 : 0, { duration: 150 });
      return;
    }
    progress.value = withTiming(next === "season" ? 1 : 0, {
      duration: 340,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });
  }

  goRef.current = go;
  useEffect(() => subscribePlanView((next) => goRef.current(next)), []);
  useFocusEffect(
    useCallback(() => {
      const next = takePlanView();
      if (next) goRef.current(next);
    }, []),
  );

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.value * pageW.value }],
  }));
  const weekFade = useAnimatedStyle(() => ({ opacity: weekOpacity.value }));
  const seasonFade = useAnimatedStyle(() => ({ opacity: seasonOpacity.value }));

  const week = (
    <WeekPane
      model={model}
      actions={actions}
      scrollRef={weekScroll}
      reduceMotion={reduceMotion}
      onFinishWeek={() => setPendingFinish(true)}
      hide={hide}
      active={view === "week"}
      topPad={hide.space + 4}
    />
  );
  const season = (
    <SeasonPane
      model={model}
      actions={actions}
      reduceMotion={reduceMotion}
      hide={hide}
      active={view === "season"}
      topPad={hide.space + 4}
    />
  );

  return (
    <View style={styles.screen}>
      <Animated.View
        accessibilityElementsHidden={!hide.blocks}
        importantForAccessibility={hide.blocks ? "auto" : "no-hide-descendants"}
        pointerEvents={hide.blocks ? "auto" : "none"}
        onLayout={hide.onHeaderLayout}
        style={[styles.chrome, { top: 0, paddingTop: insets.top }, hide.chromeStyle, hide.headerStyle]}
      >
      <Header
        weekTitle={model.weekTitle}
        view={view}
        reduceMotion={reduceMotion}
        progress={progress}
        weekFade={weekFade}
        seasonFade={seasonFade}
        onWeek={() => go("week")}
        onSeason={() => go("season")}
      />
      </Animated.View>
      {reduceMotion ? (
        <View style={styles.pager}>
          <Animated.View
            style={[StyleSheet.absoluteFill, weekFade]}
            pointerEvents={view === "week" ? "auto" : "none"}
            accessibilityElementsHidden={view !== "week"}
          >
            {week}
          </Animated.View>
          <Animated.View
            style={[StyleSheet.absoluteFill, seasonFade]}
            pointerEvents={view === "season" ? "auto" : "none"}
            accessibilityElementsHidden={view !== "season"}
          >
            {season}
          </Animated.View>
        </View>
      ) : (
        <View style={styles.pager}>
          <Animated.View style={[styles.track, { width: width * 2 }, slide]}>
            <View
              style={{ width, height: "100%" }}
              pointerEvents={view === "week" ? "auto" : "none"}
              accessibilityElementsHidden={view !== "week"}
            >
              {week}
            </View>
            <View
              style={{ width, height: "100%" }}
              pointerEvents={view === "season" ? "auto" : "none"}
              accessibilityElementsHidden={view !== "season"}
            >
              {season}
            </View>
          </Animated.View>
        </View>
      )}
      {pendingSeason ? (
        <ConfirmCard
          title={fill(copy.plan.switchTo, [pendingSeason.toLowerCase()])}
          body={copy.plan.switchBody}
          confirm={copy.plan.switch}
          onCancel={() => setPendingSeason(null)}
          onConfirm={() => {
            const next = pendingSeason;
            setPendingSeason(null);
            applySeason(next);
          }}
        />
      ) : null}
      {pendingFinish ? (
        <ConfirmCard
          title={copy.plan.finishTitle}
          body={copy.plan.finishBody}
          confirm={copy.plan.finishWeek}
          onCancel={() => setPendingFinish(false)}
          onConfirm={() => {
            setPendingFinish(false);
            engine.finishWeek();
          }}
        />
      ) : null}
      <LiveWorkoutBar />
    </View>
  );
}

function Header({
  weekTitle,
  view,
  reduceMotion,
  progress,
  weekFade,
  seasonFade,
  onWeek,
  onSeason,
}: {
  weekTitle: string;
  view: ViewName;
  reduceMotion: boolean;
  progress: SharedValue<number>;
  weekFade: object;
  seasonFade: object;
  onWeek: () => void;
  onSeason: () => void;
}) {
  const [titleW, setTitleW] = useState(0);
  const widthSv = useSharedValue(0);
  const titleSlide = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.value * widthSv.value }],
  }));

  return (
    <View style={styles.header}>
      <View
        style={styles.titleSlot}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          widthSv.value = next;
          setTitleW(next);
        }}
      >
        {reduceMotion ? (
          <>
            <Animated.Text
              accessibilityRole="header"
              style={[styles.title, StyleSheet.absoluteFill, weekFade]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {weekTitle}
            </Animated.Text>
            <Animated.Text
              accessibilityRole="header"
              style={[styles.title, StyleSheet.absoluteFill, seasonFade]}
              numberOfLines={1}
            >
              {copy.plan.season}
            </Animated.Text>
          </>
        ) : titleW > 0 ? (
          <Animated.View style={[styles.titleRow, { width: titleW * 2 }, titleSlide]}>
            <Text accessibilityRole="header" style={[styles.title, { width: titleW }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {weekTitle}
            </Text>
            <Text accessibilityRole="header" style={[styles.title, { width: titleW }]} numberOfLines={1}>
              {copy.plan.season}
            </Text>
          </Animated.View>
        ) : (
          <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
            {view === "week" ? weekTitle : copy.plan.season}
          </Text>
        )}
      </View>
      <View accessibilityRole="tablist" style={styles.switchTrack}>
        <PressableScale kind="button" brighten={view === "week"} accessibilityRole="tab" accessibilityState={{ selected: view === "week" }} aria-selected={view === "week"} hitSlop={{ top: 6, bottom: 6 }} onPress={onWeek} style={[styles.switchBtn, view === "week" && styles.switchOn]}>
          <Text style={[styles.switchText, view === "week" && styles.switchTextOn]}>{copy.plan.week}</Text>
        </PressableScale>
        <PressableScale kind="button" brighten={view === "season"} accessibilityRole="tab" accessibilityState={{ selected: view === "season" }} aria-selected={view === "season"} hitSlop={{ top: 6, bottom: 6 }} onPress={onSeason} style={[styles.switchBtn, view === "season" && styles.switchOn]}>
          <Text style={[styles.switchText, view === "season" && styles.switchTextOn]}>{copy.plan.season}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function WeekPane({
  model,
  actions,
  scrollRef,
  reduceMotion,
  onFinishWeek,
  hide,
  active,
  topPad,
}: {
  model: PlanRead;
  actions: Actions;
  scrollRef: RefObject<ScrollViewInstance | null>;
  reduceMotion: boolean;
  onFinishWeek: () => void;
  hide: HideOnScroll;
  active: boolean;
  topPad: number;
}) {
  const saving = useRef(false);

  return (
    <TabScrollMarker active={active}>
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: topPad }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={reduceMotion ? "none" : "on-drag"}
      automaticallyAdjustKeyboardInsets
      onScroll={hide.onScroll}
      scrollEventThrottle={16}
      scrollsToTop={active}
      contentInsetAdjustmentBehavior="never"
    >
      {model.finishedNote ? (
        <View style={styles.finished}>
          <Text style={styles.finishedText}>
            <Text style={styles.finishedStrong}>{copy.plan.finishedNote.split(".")[0]}.</Text>
            {model.finishedNote.slice(model.finishedNote.indexOf(".") + 1)}
          </Text>
          {model.canUndoFinish ? (
            <PressableScale accessibilityRole="button" onPress={() => actions.undoFinish()} style={styles.undo}>
              <Text style={styles.undoText}>{copy.plan.undo}</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
      {model.restFlag ? <Flag>{model.restFlag}</Flag> : null}
      {model.ckDone ? null : (
        <View style={panelStyle()}>
          <Eyebrow title={copy.plan.weeklyCheckIn} />
          <Field label={copy.plan.readiness}>
            <ChoicePills
              label={copy.plan.readiness}
              layout="wrap"
              tone="fill"
              value={model.form.ready}
              onChange={(value) => actions.setCheck("ready", value)}
              options={[
                { value: copy.plan.normal, label: copy.plan.normal },
                { value: copy.plan.low, label: copy.plan.low },
              ]}
            />
          </Field>
          <Field label={copy.plan.soreness}>
            <ChoicePills
              label={copy.plan.soreness}
              layout="wrap"
              tone="fill"
              value={model.form.sore}
              onChange={(value) => actions.setCheck("sore", value)}
              options={[copy.plan.none, copy.plan.legs, copy.plan.upperBody, copy.plan.everything].map((label) => ({
                value: label,
                label,
              }))}
            />
          </Field>
          {model.showCycle ? (
            <Field label={copy.plan.cycle}>
              <ChoicePills
                label={copy.plan.cycle}
                layout="wrap"
                tone="fill"
                value={model.form.cycle}
                onChange={(value) => actions.setCheck("cycle", value)}
                options={[copy.plan.notTracking, copy.plan.period, copy.plan.luteal, copy.plan.other].map((label) => ({
                  value: label,
                  label,
                }))}
              />
            </Field>
          ) : null}
          <Field label={copy.plan.drinking}>
            <ChoicePills
              label={copy.plan.drinking}
              layout="wrap"
              tone="fill"
              numeric
              value={model.form.drink}
              onChange={(value) => actions.setCheck("drink", value)}
              options={[
                { value: copy.plan.drink0, label: copy.plan.drink0 },
                { value: copy.plan.drinkSome, label: copy.plan.drinkSome },
                { value: copy.plan.drinkMany, label: copy.plan.drinkMany },
              ]}
            />
          </Field>
          <View style={styles.field}>
            <Text style={fieldLabelStyle()}>{copy.plan.avgWeight}</Text>
            <DialValue
              label={copy.plan.avgWeight}
              value={model.form.weight}
              placeholder={copy.plan.optional}
              spec={avgWeightDial(engine.wk.units === "kg")}
              start={
                model.form.weight.trim()
                  ? undefined
                  : Number(weightForInput(String(engine.wk.weight ?? ""))) || undefined
              }
              onChange={(text) => {
                if (saving.current) return;
                actions.commitWeight(text);
              }}
              style={styles.input}
            />
          </View>
          <PressableScale
            kind="surface"
            accessibilityRole="button"
            onPress={() => {
              saving.current = true;
              actions.saveCheckIn(model.form.weight);
              saving.current = false;
            }}
            style={styles.save}
          >
            <Text style={styles.saveText}>{copy.plan.saveCheckIn}</Text>
          </PressableScale>
        </View>
      )}

      <View style={panelStyle()}>
        <Eyebrow title={model.planHeading} />
        {model.rows.length ? (
          <View>
            {model.rows.map((row, index) => (
              <PlanRowButton key={`${row.kind}-${row.id}-${index}`} row={row} first={index === 0} onPress={() => actions.openRow(row)} />
            ))}
          </View>
        ) : (
          <Text style={noteStyle()}>{copy.plan.nothingPlanned}</Text>
        )}
        {model.liftingOn ? (
          <View style={styles.dayBlock}>
            <Text style={styles.dayLabel}>{copy.plan.liftDays}</Text>
            <DayPicker selected={model.liftDays} tone="lift" onToggle={actions.toggleLift} />
            <SessionLength minutes={Number(engine.wk.time) || 60} onChange={actions.setSession} />
            {model.inSeasonNow ? <Text style={noteStyle()}>{copy.plan.inSeasonCap}</Text> : null}
          </View>
        ) : null}
        <View style={styles.dayBlock}>
          <Text style={styles.dayLabel}>{copy.plan.activityDays}</Text>
          <DayPicker selected={model.activityDays} tone="activity" onToggle={actions.toggleActivity} />
          {model.addable.length ? (
            <>
              <Text style={styles.dayLabel}>{copy.plan.addToWeek}</Text>
              <View style={styles.addRow}>
                {model.addable.map((id) => (
                  <PressableScale
                    key={id}
                    accessibilityRole="button"
                    accessibilityLabel={`${copy.plan.addToWeek} ${engine.ACT[id]?.name ?? id}`}
                    onPress={() => actions.addWeekly(id)}
                    style={styles.addPill}
                  >
                    <Text style={styles.addPlus}>+</Text>
                    <Text style={styles.addName}>{engine.ACT[id]?.name ?? id}</Text>
                  </PressableScale>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </View>

      <FuelCard model={model} />
      {model.changes.length ? <ChangeList title={copy.plan.changes} info={copy.plan.info.changes} rows={model.changes} /> : null}
      {model.watch.length ? <WatchList notes={model.watch} /> : null}
      {model.finishedEarly ? null : (
        <PressableScale accessibilityRole="button" onPress={onFinishWeek} style={styles.newWeek}>
          <Text style={styles.newWeekText}>{copy.plan.markWeekFinished}</Text>
        </PressableScale>
      )}
      {model.ckDone ? (
        <View style={styles.checkLine}>
          <Text style={styles.checkText}>
            <Text style={styles.checkStrong}>{copy.plan.checkIn}</Text>
            {` \u00b7 ${model.checkInLine}`}
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={copy.plan.editCheckIn}
            onPress={actions.editCheckIn}
            hitSlop={4}
            style={styles.pencil}
          >
            <Edit size={18} color={theme.orange.accent} />
          </PressableScale>
        </View>
      ) : null}
      <TabBarSpacer />
    </Animated.ScrollView>
    </TabScrollMarker>
  );
}

const SHINE_BANDS = [
  { left: "30%", width: "10%", backgroundColor: "rgba(111,208,180,0.05)" },
  { left: "40%", width: "6%", backgroundColor: "rgba(111,208,180,0.10)" },
  { left: "46%", width: "4%", backgroundColor: "rgba(255,255,255,0.14)" },
  { left: "50%", width: "4%", backgroundColor: "rgba(255,255,255,0.20)" },
  { left: "54%", width: "4%", backgroundColor: "rgba(255,255,255,0.14)" },
  { left: "58%", width: "6%", backgroundColor: "rgba(111,208,180,0.10)" },
  { left: "64%", width: "6%", backgroundColor: "rgba(111,208,180,0.05)" },
] as const;

const SESSION_MINUTES = [30, 45, 60, 75] as const;

function SessionLength({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  const index = Math.max(0, SESSION_MINUTES.indexOf(minutes as (typeof SESSION_MINUTES)[number]));
  const current = SESSION_MINUTES.includes(minutes as (typeof SESSION_MINUTES)[number]) ? minutes : SESSION_MINUTES[index];
  return (
    <View style={styles.sessionBlock}>
      <Text style={styles.dayLabel}>{copy.plan.sessionLength}</Text>
      <View accessibilityLabel={copy.plan.sessionLength} style={styles.sessionStepper}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${copy.you.decrease} to ${SESSION_MINUTES[index - 1] ?? current} ${copy.you.min}`}
          disabled={index === 0}
          onPress={() => onChange(SESSION_MINUTES[index - 1])}
          style={styles.sessionStep}
        >
          <Text style={[styles.sessionSymbol, index === 0 && styles.sessionSymbolOff]}>−</Text>
        </PressableScale>
        <Text style={styles.sessionValue}>
          {current}
          <Text style={styles.sessionUnit}> {copy.you.min}</Text>
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${copy.you.increase} to ${SESSION_MINUTES[index + 1] ?? current} ${copy.you.min}`}
          disabled={index === SESSION_MINUTES.length - 1}
          onPress={() => onChange(SESSION_MINUTES[index + 1])}
          style={styles.sessionStep}
        >
          <Text style={[styles.sessionSymbol, index === SESSION_MINUTES.length - 1 && styles.sessionSymbolOff]}>+</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function PlanShine() {
  const progress = useSharedValue(0);
  const width = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withDelay(700, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) })),
        withDelay(3000, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [progress]);
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: width.value * (-1.2 + progress.value * 2.4) }, { rotate: "15deg" }],
  }));
  return (
    <View pointerEvents="none" style={styles.shineClip}>
      <Animated.View
        onLayout={(event) => {
          width.value = event.nativeEvent.layout.width;
        }}
        style={[styles.shine, sweep]}
      >
        {SHINE_BANDS.map((band) => (
          <View key={band.left} style={[styles.shineBand, band]} />
        ))}
      </Animated.View>
    </View>
  );
}

function SeasonPane({
  model,
  actions,
  reduceMotion,
  hide,
  active,
  topPad,
}: {
  model: PlanRead;
  actions: Actions;
  reduceMotion: boolean;
  hide: HideOnScroll;
  active: boolean;
  topPad: number;
}) {
  const [hot, setHot] = useState<Record<string, boolean>>({});
  const previous = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    const now: Record<string, string> = {};
    model.sentence.forEach((part) => {
      if (typeof part !== "string") now[part.key] = part.text;
    });
    const prior = previous.current;
    previous.current = now;
    if (!prior || reduceMotion) return;
    const changed: Record<string, boolean> = {};
    Object.keys(now).forEach((key) => {
      if (prior[key] !== now[key]) changed[key] = true;
    });
    if (!Object.keys(changed).length) return;
    setHot(changed);
    const timer = setTimeout(() => setHot({}), 1200);
    return () => clearTimeout(timer);
  }, [model.sentence, reduceMotion]);

  return (
    <TabScrollMarker active={active}>
    <Animated.ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: topPad }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={reduceMotion ? "none" : "on-drag"}
      automaticallyAdjustKeyboardInsets
      onScroll={hide.onScroll}
      scrollEventThrottle={16}
      scrollsToTop={active}
      contentInsetAdjustmentBehavior="never"
    >
      <View style={[panelStyle(), styles.planCard]}>
        <Eyebrow title={copy.plan.yourPlan} />
        <Sentence parts={model.sentence} hot={hot} />
        {reduceMotion ? null : <PlanShine />}
      </View>
      <View style={panelStyle()}>
        <Eyebrow title={copy.plan.season} info={copy.plan.info.season} />
        {model.seasonNote ? (
          model.seasonNote === copy.plan.pickSport ? (
            <PressableScale accessibilityRole="button" onPress={() => router.navigate("/you")}>
              <Text style={noteStyle()}>{model.seasonNote}</Text>
            </PressableScale>
          ) : (
            <Text style={noteStyle()}>{model.seasonNote}</Text>
          )
        ) : null}
        {model.seasonal ? (
          <ToggleRow label={copy.plan.inSeason} on={model.form.seasonOn} onChange={actions.setSeason} />
        ) : null}
        {model.showRamp ? (
          <ToggleRow label={copy.plan.seasonStarts} on={model.form.rampOn} onChange={actions.setRamp} />
        ) : null}
        {model.deloadFlag ? <Flag>{model.deloadFlag}</Flag> : null}
        {model.showDeload ? (
          <ToggleRow label={copy.plan.deloadThisWeek} on={model.form.deloadOn} onChange={actions.setDeload} />
        ) : null}
      </View>
      <View style={panelStyle()}>
        <Eyebrow title={copy.plan.goal} info={copy.plan.info.goal} />
        <ChoicePills
          label={copy.plan.goal}
          layout="pair"
          tone="peach"
          value={model.form.mode}
          onChange={actions.setGoal}
          options={copy.plan.goals.map((goal) => ({ value: goal.value, label: goal.label }))}
        />
        {model.pace || model.lossGoal ? (
          <View style={styles.pacePair}>
            {model.pace ? (
              <View style={styles.paceCol}>
                <Text style={fieldLabelStyle()}>{model.pace.unit}</Text>
                <DialValue
                  label={model.pace.unit}
                  accessibilityLabel={`${model.pace.shown} ${model.pace.unit}`}
                  value={model.pace.shown}
                  spec={{
                    min: model.pace.min,
                    max: model.pace.max,
                    step: model.pace.step,
                    unit: model.pace.unit,
                  }}
                  onChange={actions.setPace}
                  style={[styles.input, styles.pairInput]}
                  textStyle={styles.shareText}
                />
              </View>
            ) : null}
            {model.lossGoal ? (
              <View style={styles.paceCol}>
                <Text style={fieldLabelStyle()}>{copy.plan.fromCardio}</Text>
                <DialValue
                  label={copy.plan.fromCardio}
                  value={model.form.share}
                  spec={shareDial}
                  onChange={(text) => actions.commitShare(text)}
                  style={[styles.input, styles.pairInput]}
                  textStyle={styles.shareText}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {model.showFocus ? (
          <Field label={copy.plan.liftingFocus}>
            <ChoicePills
              label={copy.plan.liftingFocus}
              layout="wrap"
              tone="green"
              value={model.form.focus}
              onChange={actions.setFocus}
              options={copy.plan.focus.map((item) => ({ value: item.value, label: item.label }))}
            />
          </Field>
        ) : null}
      </View>
      <TabBarSpacer />
    </Animated.ScrollView>
    </TabScrollMarker>
  );
}

function Sentence({ parts, hot }: { parts: PlanPart[]; hot: Record<string, boolean> }) {
  const spoken = parts.map((part) => (typeof part === "string" ? part : part.text)).join("");
  return (
    <Text style={styles.sentence} accessibilityLabel={spoken}>
      {parts.map((part, index) =>
        typeof part === "string" ? (
          <Text key={index}>{part}</Text>
        ) : (
          <Text key={`${part.key}-${index}`} style={[styles.blank, hot[part.key] && styles.blankHot]}>
            {part.text}
          </Text>
        ),
      )}
    </Text>
  );
}

function fuelHow(model: PlanRead): string {
  const lines = [model.fuel.explain];
  if (model.fuel.deficit) lines.push(`${copy.plan.weeklyDeficit}: ${model.fuel.deficit}.`);
  if (model.fuel.finishers) lines.push(`${model.fuel.finishers}.`);
  return lines.join("\n\n");
}

function FuelCard({ model }: { model: PlanRead }) {
  return (
    <View style={panelStyle()}>
      <Eyebrow title={copy.plan.fuelRecovery} info={[{ label: copy.plan.howCalculated, body: fuelHow(model) }]} />
      <View style={styles.fuelRow}>
        <View style={styles.fuelMain}>
          <Text style={styles.fuelLabel}>{copy.plan.fuelToday}</Text>
          <View style={styles.fuelLine}>
            <Text style={styles.fuelValue}>{model.fuel.today}</Text>
            <Text style={styles.fuelUnit}>{fill(copy.plan.kcal, "").trim()}</Text>
          </View>
        </View>
        <RecoveryTile label={copy.plan.lowerBody} hours={model.recovery.lower} />
        <RecoveryTile label={copy.plan.upperBody} hours={model.recovery.upper} />
      </View>
      <View style={styles.tiles}>
        <Tile label={copy.plan.yourBase} value={model.fuel.base} />
        <Tile label={copy.plan.vsLastWeek} value={model.fuel.vsText} tone={model.fuel.vsTone} />
        <Tile label={model.fuel.lossLabel} value={model.fuel.lossValue} unit={model.fuel.lossUnit} words={!model.fuel.lossUnit} />
      </View>
    </View>
  );
}

function RecoveryTile({ label, hours }: { label: string; hours: number | null }) {
  return (
    <View style={styles.recovery}>
      <Text style={styles.tileLabel}>{label}</Text>
      {hours == null ? (
        <Text style={styles.ready}>{copy.plan.ready}</Text>
      ) : (
        <Text style={styles.restValue}>
          {hours}
          <Text style={styles.restUnit}>{` ${copy.plan.hoursRest}`}</Text>
        </Text>
      )}
    </View>
  );
}

function Tile({
  label,
  value,
  unit,
  tone,
  words,
}: {
  label: string;
  value: string;
  unit?: string | null;
  tone?: "up" | "down" | "flat";
  words?: boolean;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text
        style={[
          words ? styles.tileWords : styles.tileValue,
          tone === "up" && styles.up,
          tone === "down" && styles.down,
        ]}
      >
        {value}
        {unit ? <Text style={styles.tileUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function ChangeList({
  title,
  info,
  rows,
}: {
  title: string;
  info: readonly { label: string; body: string }[];
  rows: { cause: string; summary: string; items: string[] }[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View style={panelStyle()}>
      <Eyebrow title={title} info={info} />
      {rows.map((row) => {
        const single = row.items.length === 1 && row.summary === row.items[0];
        const shown = open === row.cause && !single;
        return (
          <View key={row.cause} style={styles.changeRow}>
            <PressableScale
              accessibilityRole="button"
              accessibilityState={{ expanded: shown, disabled: single }}
              disabled={single}
              onPress={() => setOpen(shown ? null : row.cause)}
              style={styles.changeHit}
            >
              <Text style={styles.changeCause}>{row.cause}</Text>
              <Text style={styles.changeSummary}>{row.summary}</Text>
            </PressableScale>
            {shown ? (
              <View style={styles.changePills}>
                {row.items.map((item) => {
                  const added = /\+1 set$/.test(item);
                  const cut = /−1 set$/.test(item);
                  return (
                    <View key={item} style={[styles.changePill, added && styles.changePillUp]}>
                      <Text style={[styles.changePillText, added && styles.changePillUpText, cut && styles.changePillCut]}>
                        {item}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function WatchList({ notes }: { notes: { h: string; t: string; safe: boolean }[] }) {
  const [more, setMore] = useState(false);
  const safe = notes.filter((note) => note.safe);
  const rest = notes.filter((note) => !note.safe);
  const shown = more ? notes : safe.concat(rest.slice(0, Math.max(0, 3 - safe.length)));
  const hidden = notes.length - shown.length;
  return (
    <View style={panelStyle()}>
      <Eyebrow title={copy.plan.watch} info={copy.plan.info.watch} />
      {shown.map((note) => (
        <View key={note.h} style={styles.changeRow}>
          <Text style={[styles.changeCause, note.safe && styles.watchSafe]}>{note.h}</Text>
          <Text style={styles.changeSummary}>{note.t}</Text>
        </View>
      ))}
      {hidden > 0 || more ? (
        <PressableScale accessibilityRole="button" onPress={() => setMore((open) => !open)} style={styles.moreHit}>
          <Text style={styles.moreText}>{more ? copy.plan.showLess : copy.plan.moreNotes(hidden)}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

function PlanRowButton({ row, first, onPress }: { row: PlanRow; first: boolean; onPress: () => void }) {
  const status = row.status === "done" ? copy.plan.done : row.status === "next" ? copy.plan.next : "";
  const label = [row.title, row.sub, status && row.sub !== status ? status : ""].filter(Boolean).join(", ");
  const open = row.kind === "lift" || row.openedAt != null;
  if (!open) {
    return (
      <View style={[styles.row, !first && styles.rowLine]}>
        <RowBody row={row} />
      </View>
    );
  }
  return (
    <PressableScale
      kind="surface"
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, !first && styles.rowLine]}
    >
      <RowBody row={row} />
    </PressableScale>
  );
}

function RowBody({ row }: { row: PlanRow }) {
  return (
    <>
      <View
        style={[
          styles.dot,
          {
            backgroundColor:
              row.status === "done" ? planColors.doneDot : row.kind === "act" ? theme.pink.accent : theme.green.accent,
          },
        ]}
      />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, row.status === "done" && styles.rowDone]} numberOfLines={2}>
          {row.title}
        </Text>
        <Text style={styles.rowSub}>{row.sub}</Text>
      </View>
      <StatusMark status={row.status} />
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.qLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Flag({ children }: { children: string }) {
  return (
    <View style={styles.flag}>
      <Text style={styles.flagText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.orange.background },
  chrome: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: theme.orange.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: theme.orange.background,
  },
  titleSlot: { flex: 1, overflow: "hidden", minHeight: 40, justifyContent: "center" },
  titleRow: { flexDirection: "row" },
  title: {
    color: theme.text,
    fontFamily: theme.fonts.display,
    fontSize: 34,
    lineHeight: 40,
    textTransform: "uppercase",
  },
  switchTrack: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 44,
    backgroundColor: theme.orange.surface,
    borderRadius: theme.radii.pill,
    padding: 3,
  },
  switchBtn: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  switchOn: { backgroundColor: theme.orange.selectedFill },
  switchText: { color: theme.muted, fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  switchTextOn: { color: planColors.white },
  pager: { flex: 1, overflow: "hidden" },
  track: { flexDirection: "row", height: "100%" },
  page: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28, gap: 12 },
  field: { gap: 8 },
  qLabel: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: theme.orange.background,
    color: theme.text,
    fontFamily: theme.fonts.mono,
    fontSize: 16,
    paddingHorizontal: 12,
  },
  shareInput: { alignSelf: "flex-start", minWidth: 120 },
  shareText: { textAlign: "center" },
  pacePair: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  paceCol: { flex: 1, gap: 8 },
  pairInput: { alignSelf: "stretch", minWidth: 0 },
  save: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: theme.orange.selectedFill,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: planColors.white, fontFamily: theme.fonts.bodySemi, fontSize: 16 },
  pressed: { opacity: 0.72 },
  dayBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: planColors.line,
    paddingTop: 12,
    gap: 8,
  },
  sessionBlock: { gap: 8, marginTop: 4 },
  addRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  addPill: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.pink.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addPlus: { color: theme.pink.accent, fontFamily: theme.fonts.body, fontSize: 17, lineHeight: 20 },
  addName: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  sessionStepper: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.orange.background,
    borderRadius: theme.radii.tile,
    padding: 2,
  },
  sessionStep: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sessionSymbol: { fontFamily: theme.fonts.monoMedium, fontSize: 22, color: theme.text },
  sessionSymbolOff: { color: "#393330" },
  sessionValue: { minWidth: 72, textAlign: "center", fontFamily: theme.fonts.monoMedium, fontSize: 18, color: theme.text },
  sessionUnit: { fontFamily: theme.fonts.monoMedium, fontSize: 12, color: theme.muted },
  dayLabel: {
    color: theme.orange.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
  },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: planColors.line },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  rowDone: { color: theme.muted },
  rowSub: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  fuelRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  fuelMain: { flex: 1.6, justifyContent: "center", gap: 2, minWidth: 0 },
  fuelLabel: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 14 },
  fuelLine: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  fuelValue: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 32, lineHeight: 36 },
  fuelUnit: { color: theme.muted, fontFamily: theme.fonts.mono, fontSize: 14, marginBottom: 4 },
  recovery: {
    flex: 0.85,
    backgroundColor: theme.orange.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  ready: { color: theme.green.accent, fontFamily: theme.fonts.bodySemi, fontSize: 16, lineHeight: 26 },
  restValue: { color: theme.fuel, fontFamily: theme.fonts.monoMedium, fontSize: 22, lineHeight: 26 },
  restUnit: { color: theme.muted, fontFamily: theme.fonts.monoMedium, fontSize: 12 },
  tiles: { flexDirection: "row", gap: 6 },
  tile: {
    flex: 1,
    backgroundColor: theme.orange.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  tileLabel: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  tileValue: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 15 },
  tileWords: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 14 },
  tileUnit: { color: theme.muted, fontFamily: theme.fonts.mono, fontSize: 11 },
  up: { color: theme.fuel },
  down: { color: theme.orange.accent },
  item: { color: planColors.sentence, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20 },
  bullet: { color: theme.muted },
  cause: { color: theme.text, fontFamily: theme.fonts.bodySemi },
  changeRow: { paddingVertical: 10, gap: 2 },
  changeHit: { gap: 2 },
  changeCause: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  changeSummary: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18 },
  changePills: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 8 },
  changePill: { borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.orange.surface },
  changePillUp: { backgroundColor: "#1f3029" },
  changePillText: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 12 },
  changePillUpText: { color: theme.green.accent },
  changePillCut: { color: theme.muted },
  watchSafe: { color: "#e7b94a" },
  moreHit: { minHeight: 44, justifyContent: "center" },
  moreText: { color: theme.orange.accent, fontFamily: theme.fonts.bodySemi, fontSize: 14 },
  checkLine: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: theme.orange.surface,
    paddingLeft: 16,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  newWeek: {
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.orange.selectedFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  newWeekText: { color: "#fff", fontFamily: theme.fonts.bodySemi, fontSize: 16 },
  finished: {
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: "rgba(233,182,155,0.35)",
    backgroundColor: theme.orange.surface,
    padding: 14,
    gap: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  finishedText: { flex: 1, color: theme.text, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20 },
  finishedStrong: { fontFamily: theme.fonts.bodySemi },
  undo: {
    minHeight: 40,
    borderRadius: theme.radii.tile,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  undoText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  checkText: { flex: 1, color: theme.muted, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18 },
  checkStrong: { color: theme.text, fontFamily: theme.fonts.bodySemi },
  pencil: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sentence: { color: planColors.sentence, fontFamily: theme.fonts.body, fontSize: 17, lineHeight: 27 },
  planCard: { overflow: "hidden" },
  shineClip: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" },
  shine: { position: "absolute", top: "-40%", bottom: "-40%", left: 0, right: 0 },
  shineBand: { position: "absolute", top: 0, bottom: 0 },
  blank: {
    color: planColors.white,
    fontFamily: theme.fonts.bodySemi,
    textDecorationLine: "underline",
    textDecorationColor: theme.orange.accent,
  },
  blankHot: { color: theme.orange.accent },
  flag: { backgroundColor: planColors.warn, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  flagText: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18 },
});
