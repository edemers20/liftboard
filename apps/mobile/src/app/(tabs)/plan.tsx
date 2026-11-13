import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  type ScrollViewInstance,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import {
  ChoicePills,
  ConfirmCard,
  DayPicker,
  Eyebrow,
  Notice,
  StatusMark,
  ToggleRow,
  fieldLabelStyle,
  linkStyle,
  noteStyle,
  panelStyle,
  planColors,
} from "@/components/plan-widgets";
import { copy, fill } from "@/copy";
import { takePlanView } from "@/links";
import {
  fitPace,
  migratePace,
  readPlan,
  weightForStore,
  type PlanPart,
  type PlanRead,
  type PlanRow,
} from "@/plan-model";
import { storage } from "@/storage";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { useReduceMotion } from "@/use-reduce-motion";

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
  setSeason: (on: boolean) => void;
  setRamp: (on: boolean) => void;
  setDeload: (on: boolean) => void;
  setGoal: (value: string) => void;
  setPace: (value: string) => void;
  setFocus: (value: string) => void;
  commitShare: (text: string) => void;
  openRow: (row: PlanRow) => void;
  show: (lines: string[], ms?: number) => void;
  undoFinish: () => void;
};

function savedView(): ViewName {
  return storage.getItem(VIEW_KEY) === "season" ? "season" : "week";
}

export default function PlanScreen() {
  const version = useEngineStore((state) => state.version);
  const reduceMotion = useReduceMotion();
  const model = useMemo(() => readPlan(), [version]);
  const { width } = useWindowDimensions();
  const [view, setView] = useState<ViewName>(savedView);
  const [toast, setToast] = useState<string[] | null>(null);
  const [pendingSeason, setPendingSeason] = useState<"In-season" | "Off-season" | null>(null);
  const [pendingWeek, setPendingWeek] = useState(false);
  const [pendingFinish, setPendingFinish] = useState(false);
  const [weekDone, setWeekDone] = useState<{ lifts: string; burn: string; weight: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function show(lines: string[], ms = 4500) {
    if (!lines.length) return;
    setToast(lines);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  function commit(mutate: () => void) {
    const before = engine.fx(engine.plan());
    mutate();
    engine.save();
    const after = engine.fx(engine.plan());
    const cap = engine.wk.guide === "Less" ? 2 : 5;
    return (engine.diffFx(before, after) as string[]).slice(0, cap);
  }

  function commitToast(mutate: () => void) {
    const lines = commit(mutate);
    if (lines.length) show(lines);
  }

  function applySeason(next: "In-season" | "Off-season") {
    commitToast(() => {
      engine.wk.season = next;
      engine.wk.days = next === "In-season" ? 2 : 3;
      engine.wk.done = {};
      engine.wk.donePlan = {};
      engine.wk.upNext = "";
      engine.wk.missedNote = null;
    });
  }

  const actions: Actions = {
    setCheck(key, value) {
      if (engine.wk[key] === value) return;
      commitToast(() => {
        engine.wk[key] = value;
      });
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
    toggleLift(index) {
      const current: number[] = model.liftDays;
      const on = current.includes(index);
      const next = on ? current.filter((day) => day !== index) : [...current, index].sort((a, b) => a - b);
      if (!on && engine.inSeason() && next.length > 3) {
        show([copy.plan.inSeason, copy.plan.liftDayCap]);
        return;
      }
      commitToast(() => {
        engine.wk.ldays = next;
        engine.wk.days = next.length;
        engine.syncDays();
      });
    },
    toggleActivity(index) {
      const current: number[] = model.activityDays;
      engine.wk.adays = current.includes(index)
        ? current.filter((day) => day !== index)
        : [...current, index].sort((a, b) => a - b);
      engine.save();
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
        show([copy.plan.preSeasonRamp, copy.plan.zone2Added], 6000);
        return;
      }
      commitToast(() => {
        engine.wk.ramp = value;
      });
    },
    setDeload(on) {
      commitToast(() => {
        engine.wk.deload = on ? "Yes" : "No";
      });
    },
    setGoal(value) {
      if (engine.wk.mode === value) return;
      commitToast(() => {
        engine.wk.mode = value;
        fitPace();
      });
    },
    setPace(value) {
      if (String(engine.wk.ratePct) === value) return;
      commitToast(() => {
        engine.wk.ratePct = value;
      });
    },
    setFocus(value) {
      if (engine.wk.focus === value) return;
      commitToast(() => {
        engine.wk.focus = value;
      });
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
        router.push({ pathname: "/workout/[id]", params: { id: row.id } });
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
      onStartWeek={() => setPendingWeek(true)}
      onFinishWeek={() => setPendingFinish(true)}
    />
  );
  const season = <SeasonPane model={model} actions={actions} reduceMotion={reduceMotion} />;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
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
      {toast ? <Notice lines={toast} onDismiss={() => setToast(null)} /> : null}
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
      {pendingWeek ? (
        <ConfirmCard
          title={copy.plan.startNewWeekTitle}
          body={copy.plan.startNewWeekBody}
          confirm={copy.plan.startNewWeek}
          onCancel={() => setPendingWeek(false)}
          onConfirm={() => {
            setPendingWeek(false);
            engine.newWeek();
            show([copy.plan.weekStarted]);
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
            const summary = engine.finishWeek();
            const weeks = (engine.wk.weeks || []) as { w?: number }[];
            const latest = weeks[weeks.length - 1];
            const previous = weeks[weeks.length - 2];
            const delta = latest?.w && previous?.w ? latest.w - previous.w : null;
            const weight =
              delta == null
                ? latest?.w
                  ? String(latest.w)
                  : "–"
                : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toFixed(1)}`;
            setWeekDone({
              lifts: `${summary.lifts}/${summary.planned}`,
              burn: Number(summary.cardio).toLocaleString("en-US"),
              weight,
            });
          }}
        />
      ) : null}
      {weekDone ? (
        <ConfirmCard
          title={copy.plan.weekDone}
          body={`${copy.you.lifts} ${weekDone.lifts}\n${copy.plan.extraBurn} ${weekDone.burn}\n${copy.you.weight} ${weekDone.weight}`}
          confirm={copy.plan.seeThisWeek}
          onCancel={() => setWeekDone(null)}
          onConfirm={() => {
            setWeekDone(null);
            setView("week");
          }}
        />
      ) : null}
    </SafeAreaView>
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
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: view === "week" }} aria-selected={view === "week"} hitSlop={{ top: 6, bottom: 6 }} onPress={onWeek} style={[styles.switchBtn, view === "week" && styles.switchOn]}>
          <Text style={[styles.switchText, view === "week" && styles.switchTextOn]}>{copy.plan.week}</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: view === "season" }} aria-selected={view === "season"} hitSlop={{ top: 6, bottom: 6 }} onPress={onSeason} style={[styles.switchBtn, view === "season" && styles.switchOn]}>
          <Text style={[styles.switchText, view === "season" && styles.switchTextOn]}>{copy.plan.season}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WeekPane({
  model,
  actions,
  scrollRef,
  reduceMotion,
  onStartWeek,
  onFinishWeek,
}: {
  model: PlanRead;
  actions: Actions;
  scrollRef: RefObject<ScrollViewInstance | null>;
  reduceMotion: boolean;
  onStartWeek: () => void;
  onFinishWeek: () => void;
}) {
  const [weight, setWeight] = useState(model.form.weight);
  const focused = useRef(false);
  const saving = useRef(false);

  useEffect(() => {
    if (!focused.current) setWeight(model.form.weight);
  }, [model.form.weight]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={reduceMotion ? "none" : "on-drag"}
      automaticallyAdjustKeyboardInsets
    >
      {model.finishedNote ? (
        <View style={styles.finished}>
          <Text style={styles.finishedText}>
            <Text style={styles.finishedStrong}>{copy.plan.finishedNote.split(".")[0]}.</Text>
            {model.finishedNote.slice(model.finishedNote.indexOf(".") + 1)}
          </Text>
          {model.canUndoFinish ? (
            <Pressable accessibilityRole="button" onPress={() => actions.undoFinish()} style={styles.undo}>
              <Text style={styles.undoText}>{copy.plan.undo}</Text>
            </Pressable>
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
            <TextInput
              value={weight}
              onChangeText={setWeight}
              onFocus={() => {
                focused.current = true;
              }}
              onEndEditing={(event) => {
                focused.current = false;
                if (saving.current) return;
                actions.commitWeight(event.nativeEvent.text);
              }}
              placeholder={copy.plan.optional}
              placeholderTextColor={theme.muted}
              keyboardType="decimal-pad"
              inputMode="decimal"
              accessibilityLabel={copy.plan.avgWeight}
              style={styles.input}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              saving.current = true;
              actions.saveCheckIn(weight);
              saving.current = false;
            }}
            style={({ pressed }) => [styles.save, pressed && styles.pressed]}
          >
            <Text style={styles.saveText}>{copy.plan.saveCheckIn}</Text>
          </Pressable>
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
            <Text style={styles.dayLabel}>{fill(copy.plan.usualLiftDays, [model.liftDays.length])}</Text>
            <DayPicker selected={model.liftDays} tone="lift" onToggle={actions.toggleLift} />
            {model.inSeasonNow ? <Text style={noteStyle()}>{copy.plan.inSeasonCap}</Text> : null}
          </View>
        ) : null}
        <View style={styles.dayBlock}>
          <Text style={styles.dayLabel}>{fill(copy.plan.usualActivityDays, [model.activityDays.length])}</Text>
          <DayPicker selected={model.activityDays} tone="activity" onToggle={actions.toggleActivity} />
        </View>
      </View>

      <FuelCard model={model} />
      {model.changes.length ? <ChangeList title={copy.plan.changes} info={copy.plan.info.changes} rows={model.changes} /> : null}
      {model.watch.length ? <WatchList notes={model.watch} /> : null}
      <Pressable accessibilityRole="button" onPress={onStartWeek} style={styles.newWeek}>
        <Text style={styles.newWeekText}>{copy.plan.startNewWeek}</Text>
      </Pressable>
      {model.finishedEarly ? null : (
        <Pressable accessibilityRole="button" onPress={onFinishWeek} style={styles.finishWeek}>
          <Text style={styles.finishWeekText}>{copy.plan.markWeekFinished}</Text>
        </Pressable>
      )}
      {model.ckDone ? (
        <View style={styles.checkLine}>
          <Text style={styles.checkText}>
            <Text style={styles.checkStrong}>{copy.plan.checkIn}</Text>
            {` \u00b7 ${model.checkInLine}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.plan.editCheckIn}
            onPress={actions.editCheckIn}
            hitSlop={4}
            style={styles.pencil}
          >
            <View style={styles.pencilIcon}>
              <View style={styles.pencilBody} />
              <View style={styles.pencilTip} />
            </View>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function SeasonPane({
  model,
  actions,
  reduceMotion,
}: {
  model: PlanRead;
  actions: Actions;
  reduceMotion: boolean;
}) {
  const [share, setShare] = useState(model.form.share);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const focused = useRef(false);
  const [hot, setHot] = useState<Record<string, boolean>>({});
  const previous = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    if (!focused.current) setShare(model.form.share);
  }, [model.form.share]);

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
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={reduceMotion ? "none" : "on-drag"}
      automaticallyAdjustKeyboardInsets
    >
      <View style={panelStyle()}>
        <Eyebrow title={copy.plan.yourPlan} />
        <Sentence parts={model.sentence} hot={hot} />
      </View>
      <View style={panelStyle()}>
        <Eyebrow title={copy.plan.season} info={copy.plan.info.season} />
        {model.seasonNote ? (
          model.seasonNote === copy.plan.pickSport ? (
            <Pressable accessibilityRole="button" onPress={() => router.navigate("/you")}>
              <Text style={noteStyle()}>{model.seasonNote}</Text>
            </Pressable>
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
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: goalsOpen }}
          onPress={() => setGoalsOpen((open) => !open)}
          style={styles.disclosure}
        >
          <Text style={linkStyle()}>{copy.plan.goalDefinitions}</Text>
        </Pressable>
        {goalsOpen
          ? copy.plan.goals.map((goal) => (
              <Text key={goal.value} style={noteStyle()}>
                <Text style={styles.definitionName}>{goal.label}. </Text>
                {goal.definition}
              </Text>
            ))
          : null}
        {model.lossGoal ? (
          <Field label={copy.plan.pace}>
            <ChoicePills
              label={copy.plan.pace}
              layout="wrap"
              tone="peach"
              numeric
              value={model.form.ratePct}
              onChange={actions.setPace}
              options={model.paces}
            />
          </Field>
        ) : null}
        {model.lossGoal ? (
          <View style={styles.field}>
            <Text style={fieldLabelStyle()}>{copy.plan.fromCardio}</Text>
            <TextInput
              value={share}
              onChangeText={setShare}
              onFocus={() => {
                focused.current = true;
              }}
              onEndEditing={(event) => {
                focused.current = false;
                actions.commitShare(event.nativeEvent.text);
              }}
              keyboardType="number-pad"
              inputMode="numeric"
              accessibilityLabel={copy.plan.fromCardio}
              style={[styles.input, styles.shareInput]}
            />
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
    </ScrollView>
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

function FuelCard({ model }: { model: PlanRead }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={panelStyle()}>
      <Eyebrow title={copy.plan.fuelRecovery} />
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
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.disclosure}
      >
        <Text style={linkStyle()}>{copy.plan.howCalculated}</Text>
      </Pressable>
      {open ? (
        <View style={styles.explain}>
          <Text style={noteStyle()}>{model.fuel.explain}</Text>
          {model.fuel.deficit ? (
            <View style={styles.deficit}>
              <Text style={styles.deficitLabel}>{copy.plan.weeklyDeficit}</Text>
              <Text style={styles.deficitValue}>{model.fuel.deficit}</Text>
            </View>
          ) : null}
          {model.fuel.finishers ? <Text style={noteStyle()}>{model.fuel.finishers}</Text> : null}
        </View>
      ) : null}
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
          <Text style={styles.restUnit}>{copy.plan.hoursRest}</Text>
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
  rows: { cause: string; detail: string }[];
}) {
  return (
    <View style={panelStyle()}>
      <Eyebrow title={title} info={info} />
      {rows.map((row) => (
        <Text key={`${row.cause}-${row.detail}`} style={styles.item}>
          <Text style={styles.bullet}>{"\u2022  "}</Text>
          {row.cause ? <Text style={styles.cause}>{row.cause}</Text> : null}
          <Text>{row.cause ? ` \u2192 ${row.detail}` : row.detail}</Text>
        </Text>
      ))}
    </View>
  );
}

function WatchList({ notes }: { notes: string[] }) {
  return (
    <View style={panelStyle()}>
      <Eyebrow title={copy.plan.watch} info={copy.plan.info.watch} />
      {notes.map((note) => (
        <Text key={note} style={styles.item}>
          <Text style={styles.bullet}>{"\u2022  "}</Text>
          {note}
        </Text>
      ))}
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.rowLine, pressed && styles.pressed]}
    >
      <RowBody row={row} />
    </Pressable>
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
    backgroundColor: theme.orange.surface,
    borderRadius: theme.radii.pill,
    padding: 3,
  },
  switchBtn: {
    minHeight: 32,
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
  shareInput: { alignSelf: "flex-start", minWidth: 120, textAlign: "center" },
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
  disclosure: { minHeight: 44, justifyContent: "center" },
  explain: { gap: 8 },
  deficit: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  deficitLabel: { color: planColors.sentence, fontFamily: theme.fonts.body, fontSize: 13 },
  deficitValue: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 13 },
  item: { color: planColors.sentence, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20 },
  bullet: { color: theme.muted },
  cause: { color: theme.text, fontFamily: theme.fonts.bodySemi },
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
  finishWeek: {
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  finishWeekText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 16 },
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
  pencilIcon: { width: 16, height: 16, transform: [{ rotate: "-40deg" }] },
  pencilBody: {
    position: "absolute",
    left: 3,
    top: 1,
    width: 8,
    height: 11,
    borderWidth: 1.6,
    borderColor: theme.orange.accent,
    borderRadius: 1,
  },
  pencilTip: {
    position: "absolute",
    left: 4.5,
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: theme.orange.accent,
  },
  sentence: { color: planColors.sentence, fontFamily: theme.fonts.body, fontSize: 17, lineHeight: 27 },
  blank: {
    color: planColors.white,
    fontFamily: theme.fonts.bodySemi,
    textDecorationLine: "underline",
    textDecorationColor: theme.orange.accent,
  },
  blankHot: { color: theme.orange.accent },
  definitionName: { color: theme.text, fontFamily: theme.fonts.bodySemi },
  flag: { backgroundColor: planColors.warn, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  flagText: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18 },
});
