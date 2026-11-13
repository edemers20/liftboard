import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { copy } from "@/copy";
import {
  chooseSport,
  clampCount,
  createDraft,
  finishOnboarding,
  firstWorkout,
  fromDisplayWeight,
  isSeasonal,
  planRows,
  previewOnboarding,
  skipOnboarding,
  stepperRows,
  toDisplayWeight,
  toggleDay,
  toggleInSeason,
  weightUnit,
  type Draft,
  type PlanPreview,
  type PlanRow,
} from "@/onboarding/logic";
import { useEngineStore } from "@/store";
import { theme } from "@/theme";
import { nativeDriver, useReduceMotion } from "@/use-reduce-motion";

const LEVEL_NAMES = [copy.onboarding.beginner, copy.onboarding.someExperience, copy.onboarding.advanced] as const;
const LEVEL_MODES = [copy.onboarding.guided, copy.onboarding.standard, copy.onboarding.flexible] as const;
const LEVEL_COLORS = ["#6fd0b4", "#edeae8", "#e9b69b"] as const;
const BULLET_COLORS = ["#6fd0b4", "#9fc7a8", "#e9b69b"] as const;

function mix(from: string, to: string, amount: number) {
  const read = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const left = read(from);
  const right = read(to);
  const mixed = left.map((channel, index) => Math.round(channel + (right[index] - channel) * amount));
  return `rgb(${mixed.join(",")})`;
}

function SlideIn({ delay, reduce, children }: { delay: number; reduce: boolean; children: ReactNode }) {
  const x = useRef(new Animated.Value(reduce ? 0 : 28)).current;
  const opacity = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.parallel([
      Animated.timing(x, {
        toValue: 0,
        duration: 1000,
        delay,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: nativeDriver,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1000,
        delay,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: nativeDriver,
      }),
    ]).start();
  }, [delay, opacity, reduce, x]);
  return <Animated.View style={{ opacity, transform: [{ translateX: x }] }}>{children}</Animated.View>;
}

function FadeBlock({ step, reduce, children }: { step: number; reduce: boolean; children: ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      y.setValue(0);
      return;
    }
    opacity.setValue(0);
    y.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: nativeDriver }),
      Animated.timing(y, { toValue: 0, duration: 300, useNativeDriver: nativeDriver }),
    ]).start();
  }, [opacity, reduce, step, y]);
  return <Animated.View style={{ opacity, transform: [{ translateY: y }], gap: 12 }}>{children}</Animated.View>;
}

function BarbellIcon() {
  return (
    <View style={styles.iconBox}>
      <View style={[styles.barbellShaft, { backgroundColor: "#6fd0b4" }]} />
      <View style={[styles.barbellEnd, { left: 2, height: 12, backgroundColor: "#6fd0b4" }]} />
      <View style={[styles.barbellEnd, { left: 6, height: 18, backgroundColor: "#6fd0b4" }]} />
      <View style={[styles.barbellEnd, { right: 6, height: 18, backgroundColor: "#6fd0b4" }]} />
      <View style={[styles.barbellEnd, { right: 2, height: 12, backgroundColor: "#6fd0b4" }]} />
    </View>
  );
}

function CheckIcon() {
  return (
    <View style={styles.iconBox}>
      <View style={styles.checkRing}>
        <View style={styles.checkMark} />
      </View>
    </View>
  );
}

function DropIcon() {
  return (
    <View style={styles.iconBox}>
      <View style={styles.drop} />
    </View>
  );
}

function ExampleChip({ text, tint }: { text: string; tint?: string }) {
  return (
    <Text style={[styles.chip, tint ? { color: tint, backgroundColor: `${tint}38` } : null]}>{text}</Text>
  );
}

function ExampleLever({
  color,
  pairs,
  reduce,
}: {
  color: string;
  pairs: readonly (readonly [string, string])[];
  reduce: boolean;
}) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: nativeDriver }).start(({ finished }) => {
        if (!finished) return;
        setIndex((current) => (current + 1) % pairs.length);
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: nativeDriver }).start();
      });
    }, 3500);
    return () => clearInterval(id);
  }, [opacity, pairs.length, reduce]);
  const pair = pairs[reduce ? 0 : index] ?? pairs[0];
  const label = pairs.map((item) => `${item[0]}. ${item[1]}`).join(". ");
  return (
    <Animated.View accessibilityLabel={label} style={[styles.lever, { opacity }]}>
      <ExampleChip text={pair[0]} />
      <Text style={styles.arrow}>→</Text>
      <ExampleChip text={pair[1]} tint={color} />
    </Animated.View>
  );
}

function FeatureCard({
  delay,
  background,
  icon,
  title,
  body,
  lever,
  reduce,
}: {
  delay: number;
  background: string;
  icon: ReactNode;
  title: string;
  body: string;
  lever: ReactNode;
  reduce: boolean;
}) {
  return (
    <SlideIn delay={delay} reduce={reduce}>
      <View style={[styles.feature, { backgroundColor: background }]}>
        {icon}
        <View style={styles.featureText}>
          <Text style={styles.featureTitle}>{title}</Text>
          <Text style={styles.featureBody}>{body}</Text>
          {lever}
        </View>
      </View>
    </SlideIn>
  );
}

function PlanWeek({ reduce }: { reduce: boolean }) {
  const o = copy.onboarding;
  return (
    <View style={styles.features}>
      <FeatureCard
        delay={300}
        reduce={reduce}
        background="#1d2220"
        icon={<BarbellIcon />}
        title={o.liftToday}
        body={o.liftTodayBody}
        lever={
          <ExampleLever
            color="#6fd0b4"
            reduce={reduce}
            pairs={[
              [o.lastUp, o.todayUp],
              [o.lastHold, o.todayHold],
            ]}
          />
        }
      />
      <FeatureCard
        delay={600}
        reduce={reduce}
        background="#241f21"
        icon={<CheckIcon />}
        title={o.fits}
        body={o.fitsBody}
        lever={
          <ExampleLever
            color="#fc96bf"
            reduce={reduce}
            pairs={[
              [o.pickleTwice, o.legDay],
              [o.missedWed, o.liftMoves],
            ]}
          />
        }
      />
      <FeatureCard
        delay={900}
        reduce={reduce}
        background="#2a221c"
        icon={<DropIcon />}
        title={o.fuelRecover}
        body={o.fuelRecoverBody}
        lever={
          <ExampleLever
            color="#fea06a"
            reduce={reduce}
            pairs={[
              [o.spinClass, o.fuelPlus],
              [o.feelingRough, o.restPlus],
            ]}
          />
        }
      />
    </View>
  );
}

function LevelSlider({
  value,
  onChange,
}: {
  value: 0 | 1 | 2;
  onChange: (level: 0 | 1 | 2) => void;
}) {
  const width = useRef(1);
  const pick = (x: number) => {
    const ratio = Math.min(1, Math.max(0, x / width.current));
    onChange(Math.round(ratio * 2) as 0 | 1 | 2);
  };
  return (
    <View style={styles.sliderBlock}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={copy.you.experience}
        accessibilityValue={{ min: 0, max: 2, now: value, text: LEVEL_NAMES[value] }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") onChange(Math.min(2, value + 1) as 0 | 1 | 2);
          if (event.nativeEvent.actionName === "decrement") onChange(Math.max(0, value - 1) as 0 | 1 | 2);
        }}
        onLayout={(event) => {
          width.current = event.nativeEvent.layout.width;
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => pick(event.nativeEvent.locationX)}
        onResponderMove={(event) => pick(event.nativeEvent.locationX)}
        style={styles.sliderHit}
      >
        <View style={styles.sliderTrack}>
          <View style={styles.sliderGradient}>
            {Array.from({ length: 24 }, (_, index) => (
              <View key={index} style={{ flex: 1, backgroundColor: mix("#6fd0b4", "#e9b69b", index / 23) }} />
            ))}
          </View>
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            value === 0 && styles.thumbStart,
            value === 1 && styles.thumbMid,
            value === 2 && styles.thumbEnd,
          ]}
        />
      </View>
      <View style={styles.levelNames}>
        {LEVEL_NAMES.map((name, index) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityState={{ selected: value === index }}
            onPress={() => onChange(index as 0 | 1 | 2)}
            style={styles.levelNameHit}
          >
            <Text style={[styles.levelName, value === index && { color: LEVEL_COLORS[index] }, index === 1 && styles.levelCenter, index === 2 && styles.levelEnd]}>
              {name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function LevelDemo({ level, onChange }: { level: 0 | 1 | 2; onChange: (level: 0 | 1 | 2) => void }) {
  const o = copy.onboarding;
  const showTip = level === 0;
  const showWhy = level === 0;
  const showSwap = level === 2;
  const showRest = level !== 2;
  return (
    <View>
      <LevelSlider value={level} onChange={onChange} />
      <View accessibilityLiveRegion="polite" style={styles.demo}>
        <View style={styles.demoTop}>
          <Text style={styles.demoEye}>{o.dayOneLower}</Text>
          <Text style={styles.demoMode}>{LEVEL_MODES[level]}</Text>
        </View>
        {showTip ? (
          <View style={styles.tip}>
            <View style={styles.infoDot}>
              <Text style={styles.infoLetter}>i</Text>
            </View>
            <Text style={styles.tipText}>{o.startLight}</Text>
          </View>
        ) : null}
        <View style={styles.demoRow}>
          <Text style={styles.demoName}>{o.hipThrust}</Text>
          <Text style={styles.demoSets}>{o.setHip[level]}</Text>
        </View>
        {showWhy ? <Text style={styles.why}>{o.whyHip}</Text> : null}
        <View style={[styles.demoRow, styles.demoRule]}>
          <Text style={styles.demoName}>{o.romanian}</Text>
          <Text style={styles.demoSets}>{o.setHinge[level]}</Text>
        </View>
        {showSwap ? (
          <View style={styles.swap}>
            <Text style={styles.swapLabel}>{o.swapFreely}</Text>
            <View style={styles.swapChips}>
              {[o.bStance, o.sumo, o.addExercise].map((label) => (
                <Text key={label} style={styles.swapChip}>
                  {label}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
        {showRest ? (
          <View style={styles.restBox}>
            <Text style={styles.restText}>{o.restTimer}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.bullets}>
        {o.demoBullets[level].map((line) => (
          <View key={line} style={styles.bulletRow}>
            <View style={[styles.bullet, { backgroundColor: BULLET_COLORS[level] }]} />
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PillGrid({
  items,
  selected,
  tone,
  onPress,
}: {
  items: readonly { id: string; label: string }[];
  selected: string;
  tone: "pink" | "green";
  onPress: (id: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const on = item.id === selected;
        return (
          <View key={item.label} style={styles.gridCell}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onPress(item.id)}
              style={[styles.pill, on && (tone === "pink" ? styles.pillPink : styles.pillGreen)]}
            >
              <Text style={[styles.pillText, on && (tone === "pink" ? styles.pillPinkText : styles.pillGreenText)]}>
                {item.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function ChoiceList({
  items,
  selected,
  onPress,
}: {
  items: readonly { id: string; label: string; detail: string }[];
  selected: string;
  onPress: (id: string) => void;
}) {
  return (
    <View style={styles.choices}>
      {items.map((item) => {
        const on = item.id === selected;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onPress(item.id)}
            style={[styles.choice, on && styles.choiceOn]}
          >
            <Text style={[styles.choiceTitle, on && styles.choiceOnText]}>{item.label}</Text>
            <Text style={[styles.choiceDetail, on && styles.choiceOnDetail]}>{item.detail}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SwitchRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: on }}
        onPress={onToggle}
        hitSlop={8}
        style={styles.switchHit}
      >
        <View style={[styles.switchTrack, on && styles.switchTrackOn]}>
          <View style={[styles.switchKnob, on && styles.switchKnobOn]} />
        </View>
      </Pressable>
    </View>
  );
}

function DaysStep({
  draft,
  onDay,
  onCount,
}: {
  draft: Draft;
  onDay: (day: number) => void;
  onCount: (id: string, kind: "sport" | "other", delta: number) => void;
}) {
  const o = copy.onboarding;
  return (
    <View style={styles.stack}>
      <Text style={styles.eyebrow}>{o.usualLiftDays(draft.days.length)}</Text>
      <View style={styles.dayRow}>
        {copy.weekdays.map((name, index) => {
          const on = draft.days.includes(index);
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={name}
              accessibilityState={{ selected: on }}
              onPress={() => onDay(index)}
              style={[styles.day, on && styles.dayOn]}
            >
              <Text style={[styles.dayText, on && styles.dayTextOn]}>{copy.weekdayLetters.charAt(index)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.eyebrow}>{o.otherActivities}</Text>
      {stepperRows(draft).map((row) => (
        <View key={`${row.kind}-${row.id}`} style={styles.stepper}>
          <Text style={styles.stepperName}>{row.name}</Text>
          <View style={styles.stepperControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={o.fewer(row.name)}
              onPress={() => onCount(row.id, row.kind, -1)}
              style={styles.stepperButton}
            >
              <Text style={styles.stepperSymbol}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{row.value}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={o.more(row.name)}
              onPress={() => onCount(row.id, row.kind, 1)}
              style={styles.stepperButton}
            >
              <Text style={styles.stepperSymbol}>+</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  focused,
  onFocus,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  numeric: boolean;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#8a827e"
        keyboardType={numeric ? "number-pad" : "decimal-pad"}
        inputMode={numeric ? "numeric" : "decimal"}
        onFocus={onFocus}
        onBlur={onBlur}
        style={[styles.input, focused && styles.inputFocused]}
      />
    </View>
  );
}

function SexPills({ sex, onPress }: { sex: Draft["sex"]; onPress: (sex: Draft["sex"]) => void }) {
  return (
    <PillGrid
      tone="green"
      selected={sex}
      items={copy.onboarding.sexes.map((label) => ({ id: label, label }))}
      onPress={(id) => onPress(id as Draft["sex"])}
    />
  );
}

function AboutFields({
  draft,
  onSex,
  onBio,
}: {
  draft: Draft;
  onSex: (sex: Draft["sex"]) => void;
  onBio: (key: "age" | "height" | "weight" | "bodyFat" | "steps", value: string) => void;
}) {
  const o = copy.onboarding;
  const [focused, setFocused] = useState<string | null>(null);
  const [weightText, setWeightText] = useState<string | null>(null);
  return (
    <View style={styles.stack}>
      <SexPills sex={draft.sex} onPress={onSex} />
      <View style={styles.fields}>
        <Field
          label={o.age}
          value={draft.age}
          numeric
          focused={focused === "age"}
          onFocus={() => setFocused("age")}
          onBlur={() => setFocused(null)}
          onChange={(value) => onBio("age", value)}
        />
        <Field
          label={o.height}
          value={draft.height}
          numeric={false}
          focused={focused === "height"}
          onFocus={() => setFocused("height")}
          onBlur={() => setFocused(null)}
          onChange={(value) => onBio("height", value)}
        />
        <Field
          label={o.weight(weightUnit())}
          value={weightText ?? toDisplayWeight(draft.weight)}
          numeric={false}
          focused={focused === "weight"}
          onFocus={() => {
            setFocused("weight");
            setWeightText(toDisplayWeight(draft.weight));
          }}
          onBlur={() => {
            setFocused(null);
            setWeightText(null);
          }}
          onChange={(value) => {
            setWeightText(value);
            onBio("weight", fromDisplayWeight(value));
          }}
        />
        <Field
          label={o.bodyFat}
          value={draft.bodyFat}
          placeholder={o.optional}
          numeric={false}
          focused={focused === "bodyFat"}
          onFocus={() => setFocused("bodyFat")}
          onBlur={() => setFocused(null)}
          onChange={(value) => onBio("bodyFat", value)}
        />
        <Field
          label={o.dailySteps}
          value={draft.steps}
          placeholder={o.stepsExample}
          numeric
          focused={focused === "steps"}
          onFocus={() => setFocused("steps")}
          onBlur={() => setFocused(null)}
          onChange={(value) => onBio("steps", value)}
        />
      </View>
    </View>
  );
}

function PlanCard({ rows }: { rows: PlanRow[] }) {
  return (
    <View style={styles.plan} accessibilityLabel={copy.onboarding.planSoFar}>
      <Text style={styles.weye}>{copy.onboarding.planSoFar}</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.planRow}>
          <Text style={styles.planLabel}>{row.label}</Text>
          <Text style={[styles.planValue, row.mono && styles.planMono]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function FadedRow({ item, index, reduce }: { item: { title: string; when: string; activity: boolean }; index: number; reduce: boolean }) {
  const opacity = useRef(new Animated.Value(reduce ? 0.45 : 0)).current;
  const y = useRef(new Animated.Value(reduce ? 0 : 6)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0.45,
        duration: reduce ? 0 : 500,
        delay: reduce ? 0 : 300 + index * 120,
        useNativeDriver: nativeDriver,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: reduce ? 0 : 500,
        delay: reduce ? 0 : 300 + index * 120,
        useNativeDriver: nativeDriver,
      }),
    ]).start();
  }, [index, opacity, reduce, y]);
  return (
    <Animated.View style={[styles.restRow, item.activity && styles.restActivity, { opacity, transform: [{ translateY: y }] }]}>
      <Text style={styles.restTitle}>{item.title}</Text>
      <Text style={styles.restWhen}>{item.when}</Text>
    </Animated.View>
  );
}

function Dots({ step }: { step: number }) {
  const current = step - 2;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 7, now: current }} style={styles.dots}>
      {[1, 2, 3, 4, 5, 6, 7].map((dot) => (
        <View key={dot} style={[styles.dot, dot < current && styles.dotPast, dot === current && styles.dotOn]} />
      ))}
    </View>
  );
}

function nextLabel(step: number) {
  const o = copy.onboarding;
  if (step === 0 || step === 2) return o.getStarted;
  if (step === 8) return o.buildPlan;
  if (step === 9) return o.goWorkouts;
  return o.next;
}

export function OnboardingScreen() {
  const router = useRouter();
  const reduce = useReduceMotion();
  const [draft, setDraft] = useState(createDraft);
  const draftRef = useRef(draft);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const change = useCallback((recipe: (current: Draft) => Draft) => {
    const next = recipe(draftRef.current);
    draftRef.current = next;
    setDraft(next);
    if (next.step >= 8) setPreview(previewOnboarding(next));
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (draft.step !== 2 || draft.demoTouched) return;
    const id = setTimeout(() => {
      change((current) => {
        if (current.step !== 2 || current.demoTouched) return current;
        return { ...current, demoLevel: ((current.demoLevel + 1) % 3) as 0 | 1 | 2 };
      });
    }, 2600);
    return () => clearTimeout(id);
  }, [change, draft.demoLevel, draft.demoTouched, draft.step]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(id);
  }, [toast]);

  const leaveToWorkouts = useCallback(() => {
    if (router.canDismiss()) router.dismissTo("/");
    else router.replace("/");
  }, [router]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const current = draftRef.current;
      if (current.step > (current.setupDone ? 1 : 0)) {
        change((item) => ({ ...item, step: item.step - 1 }));
      }
      return true;
    });
    return () => sub.remove();
  }, [change]);

  const onNext = () => {
    Keyboard.dismiss();
    const current = draftRef.current;
    if (current.step >= 9) {
      useEngineStore.getState().call(() => finishOnboarding(current));
      leaveToWorkouts();
      return;
    }
    change((item) => ({ ...item, step: item.step + 1 }));
  };

  const onBack = () => {
    change((item) => ({ ...item, step: Math.max(item.setupDone ? 1 : 0, item.step - 1) }));
  };

  const onSkip = () => {
    useEngineStore.getState().call(() => skipOnboarding());
    close();
  };

  const showBack = draft.step > 0 && !(draft.setupDone && draft.step === 1);
  const showSkip = draft.setupDone && draft.step > 0;
  const showPlan = draft.step >= 3 && draft.step <= 8;
  const question = draft.step >= 3 ? copy.onboarding.questions[draft.step - 3] : null;
  const title =
    draft.step === 0
      ? copy.onboarding.welcome
      : draft.step === 1
        ? copy.onboarding.planYourWeek
        : draft.step === 2
          ? copy.onboarding.asMuchHelp
          : question?.title ?? "";
  const lead =
    draft.step === 0
      ? copy.onboarding.thanks
      : draft.step === 1
        ? copy.onboarding.share
        : draft.step === 2
          ? copy.onboarding.sameWorkout
          : question?.body ?? "";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          key={draft.step}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.top}>
            {draft.step >= 3 ? (
              <Dots step={draft.step} />
            ) : (
              <Text style={styles.eyebrow}>
                {draft.step === 0 ? copy.onboarding.liftBoard : draft.step === 1 ? copy.onboarding.whatItsFor : copy.onboarding.forAnyLevel}
              </Text>
            )}
            {showSkip ? (
              <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skip}>
                <Text style={styles.skipText}>{copy.onboarding.skip}</Text>
              </Pressable>
            ) : (
              <View />
            )}
          </View>
          <FadeBlock step={draft.step} reduce={reduce}>
            <Text
              accessibilityRole="header"
              style={[styles.title, draft.step === 1 && styles.titleBig, draft.step === 2 && styles.titleLevel]}
            >
              {title}
            </Text>
            <Text style={[styles.lead, draft.step >= 3 && styles.leadSm]}>{lead}</Text>
            {draft.step === 0 ? <Text style={styles.sign}>{copy.onboarding.emma}</Text> : null}
            {draft.step === 1 ? <PlanWeek reduce={reduce} /> : null}
            {draft.step === 2 ? (
              <LevelDemo
                level={draft.demoLevel}
                onChange={(level) => change((item) => ({ ...item, demoTouched: true, demoLevel: level }))}
              />
            ) : null}
            {draft.step === 3 ? (
              <View style={styles.stack}>
                <PillGrid
                  tone="pink"
                  selected={draft.sport}
                  items={copy.onboarding.sports}
                  onPress={(id) => change((item) => chooseSport(item, id))}
                />
                {draft.sport && isSeasonal(draft.sport) ? (
                  <SwitchRow
                    label={copy.onboarding.inSeasonNow}
                    on={draft.inSeason}
                    onToggle={() => change((item) => toggleInSeason(item))}
                  />
                ) : null}
              </View>
            ) : null}
            {draft.step === 4 ? (
              <ChoiceList
                selected={draft.goal}
                items={copy.onboarding.goals}
                onPress={(id) => change((item) => ({ ...item, goal: id as Draft["goal"] }))}
              />
            ) : null}
            {draft.step === 5 ? (
              <DaysStep
                draft={draft}
                onDay={(day) => {
                  const result = toggleDay(draftRef.current, day);
                  if (result.limited) {
                    setToast({ title: copy.onboarding.inSeason, body: copy.onboarding.inSeasonLimit });
                    return;
                  }
                  change(() => result.draft);
                }}
                onCount={(id, kind, delta) =>
                  change((item) => {
                    if (kind === "sport") return { ...item, sportCount: clampCount(item.sportCount + delta) };
                    return {
                      ...item,
                      activities: { ...item.activities, [id]: clampCount((item.activities[id] || 0) + delta) },
                    };
                  })
                }
              />
            ) : null}
            {draft.step === 6 ? (
              <PillGrid
                tone="green"
                selected={draft.focus}
                items={copy.onboarding.focusOptions}
                onPress={(id) => change((item) => ({ ...item, focus: id as Draft["focus"] }))}
              />
            ) : null}
            {draft.step === 7 ? (
              <ChoiceList
                selected={draft.level}
                items={copy.onboarding.levels}
                onPress={(id) => change((item) => ({ ...item, level: id as Draft["level"] }))}
              />
            ) : null}
            {draft.step === 8 ? (
              <AboutFields
                draft={draft}
                onSex={(sex) => change((item) => ({ ...item, sex }))}
                onBio={(key, value) => change((item) => ({ ...item, [key]: value }))}
              />
            ) : null}
            {draft.step === 9 && preview ? <Ready draft={draft} preview={preview} reduce={reduce} /> : null}
          </FadeBlock>
          {showPlan ? <View style={styles.spacer} /> : null}
          {showPlan ? <PlanCard rows={planRows(draft, preview?.food ?? null)} /> : null}
        </ScrollView>
        {toast ? (
          <Pressable accessibilityRole="alert" onPress={() => setToast(null)} style={styles.toast}>
            <Text style={styles.toastTitle}>{toast.title}</Text>
            <Text style={styles.toastBody}>{toast.body}</Text>
          </Pressable>
        ) : null}
        <View style={styles.actions}>
          {showBack ? (
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
              <Text style={styles.backText}>{copy.onboarding.back}</Text>
            </Pressable>
          ) : (
            <View style={styles.backSpacer} />
          )}
          <Pressable
            accessibilityRole="button"
            onPress={onNext}
            style={[styles.next, draft.step === 9 && styles.nextGo]}
          >
            <Text style={[styles.nextText, draft.step === 9 && styles.nextGoText]}>{nextLabel(draft.step)}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Ready({ draft, preview, reduce }: { draft: Draft; preview: PlanPreview; reduce: boolean }) {
  const workout = firstWorkout(draft, preview);
  return (
    <View style={styles.stack}>
      <View style={styles.first}>
        <Text style={styles.weye}>{workout.eyebrow}</Text>
        <Text style={styles.workoutTitle}>{workout.title}</Text>
        <Text style={styles.firstNote}>{copy.onboarding.startingWeights}</Text>
      </View>
      <View style={styles.restList}>
        {workout.rest.map((item, index) => (
          <FadedRow key={item.key} item={item} index={index} reduce={reduce} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.orange.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 14 },
  top: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: {
    color: "#e9b69b",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  weye: {
    color: "#fea06a",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  skip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  skipText: { color: "#e1dddb", fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  title: {
    color: theme.text,
    fontFamily: theme.fonts.display,
    fontSize: 30,
    lineHeight: 34,
    textTransform: "uppercase",
  },
  titleBig: { fontSize: 38, lineHeight: 42 },
  titleLevel: { fontSize: 34, lineHeight: 38 },
  lead: { color: "#d4cfcc", fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 24 },
  leadSm: { fontSize: 14, lineHeight: 21 },
  sign: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 16 },
  dots: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { height: 6, width: 8, borderRadius: 3, backgroundColor: "#393330" },
  dotPast: { backgroundColor: "#e9b69b" },
  dotOn: { width: 22, backgroundColor: "#e9b69b" },
  features: { gap: 10, overflow: "hidden" },
  feature: { flexDirection: "row", gap: 14, alignItems: "flex-start", borderRadius: 14, padding: 14 },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 16 },
  featureBody: { color: "#d4cfcc", fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20 },
  iconBox: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  barbellShaft: { position: "absolute", width: 16, height: 2, borderRadius: 1 },
  barbellEnd: { position: "absolute", width: 2, borderRadius: 1 },
  checkRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: "#fc96bf",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    width: 8,
    height: 5,
    marginTop: -2,
    borderLeftWidth: 1.8,
    borderBottomWidth: 1.8,
    borderColor: "#fc96bf",
    transform: [{ rotate: "-45deg" }],
  },
  drop: {
    width: 14,
    height: 14,
    backgroundColor: "#fea06a",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 12,
    transform: [{ rotate: "45deg" }],
  },
  lever: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 },
  chip: {
    color: theme.text,
    backgroundColor: "rgba(255,255,255,0.07)",
    fontFamily: theme.fonts.monoMedium,
    fontSize: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  arrow: { color: theme.muted, fontSize: 14 },
  sliderBlock: { gap: 2 },
  sliderHit: { height: 44, justifyContent: "center" },
  sliderTrack: { marginHorizontal: 14 },
  sliderGradient: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden" },
  thumb: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    top: 8,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  thumbStart: { left: 0 },
  thumbMid: { left: "50%", marginLeft: -14 },
  thumbEnd: { right: 0 },
  levelNames: { flexDirection: "row" },
  levelNameHit: { flex: 1, minHeight: 44, justifyContent: "center" },
  levelName: { color: "#8f8783", fontFamily: theme.fonts.bodySemi, fontSize: 12 },
  levelCenter: { textAlign: "center" },
  levelEnd: { textAlign: "right" },
  demo: { backgroundColor: "#1d2220", borderRadius: 16, padding: 14, gap: 8, marginTop: 8 },
  demoTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  demoEye: { color: "#6fd0b4", fontFamily: theme.fonts.bodySemi, fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase" },
  demoMode: { color: theme.muted, fontFamily: theme.fonts.monoMedium, fontSize: 13 },
  demoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  demoRule: { borderTopWidth: 1, borderTopColor: "#2c3431", paddingTop: 8 },
  demoName: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15, flexShrink: 1 },
  demoSets: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 13 },
  tip: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#24302b", borderRadius: 10, padding: 10 },
  infoDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.6,
    borderColor: "#6fd0b4",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  infoLetter: { color: "#6fd0b4", fontFamily: theme.fonts.bodySemi, fontSize: 10, lineHeight: 12 },
  tipText: { color: "#d4cfcc", fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, flex: 1 },
  why: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18 },
  swap: { gap: 6 },
  swapLabel: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  swapChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  swapChip: {
    color: theme.text,
    backgroundColor: "#2c3431",
    fontFamily: theme.fonts.body,
    fontSize: 12,
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  restBox: { backgroundColor: "#2a221c", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  restText: { color: "#d4cfcc", fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18 },
  bullets: { gap: 6, marginTop: 8 },
  bulletRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  bulletText: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20, flex: 1 },
  stack: { gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  gridCell: { width: "33.33%", padding: 3 },
  pill: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: theme.orange.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  pillText: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 14, textAlign: "center" },
  pillPink: { backgroundColor: "rgba(252,150,191,0.18)" },
  pillPinkText: { color: "#fc96bf", fontFamily: theme.fonts.bodySemi },
  pillGreen: { backgroundColor: "rgba(111,208,180,0.16)" },
  pillGreenText: { color: "#6fd0b4", fontFamily: theme.fonts.bodySemi },
  choices: { gap: 8 },
  choice: { minHeight: 56, borderRadius: 12, backgroundColor: theme.orange.surface, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  choiceOn: { backgroundColor: "#9d5324" },
  choiceTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  choiceOnText: { color: "#fff" },
  choiceDetail: { color: "rgba(237,234,232,0.8)", fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 16 },
  choiceOnDetail: { color: "rgba(255,255,255,0.85)" },
  switchRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  switchLabel: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 16, flex: 1 },
  switchHit: { minWidth: 52, minHeight: 44, justifyContent: "center" },
  switchTrack: { width: 52, height: 32, borderRadius: 16, backgroundColor: "#393330", padding: 3 },
  switchTrackOn: { backgroundColor: "#9d5324" },
  switchKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#edeae8" },
  switchKnobOn: { backgroundColor: "#fff", transform: [{ translateX: 20 }] },
  dayRow: { flexDirection: "row", gap: 4 },
  day: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: theme.orange.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dayOn: { backgroundColor: "#2f3a35" },
  dayText: { color: theme.muted, fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  dayTextOn: { color: "#6fd0b4" },
  stepper: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  stepperName: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 16, flex: 1 },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.orange.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperSymbol: { color: theme.text, fontSize: 20, lineHeight: 22 },
  stepperValue: { width: 28, textAlign: "center", color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 15 },
  fields: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  field: { width: "50%", padding: 4, gap: 4 },
  fieldLabel: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3b3431",
    backgroundColor: "#2a2522",
    color: theme.text,
    fontFamily: theme.fonts.mono,
    fontSize: 16,
    paddingHorizontal: 12,
  },
  inputFocused: { borderColor: "#e9b69b" },
  spacer: { flexGrow: 1, flexShrink: 1 },
  plan: { backgroundColor: "#1d2220", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  planRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  planLabel: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 14 },
  planValue: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 14, textAlign: "right", flexShrink: 1 },
  planMono: { fontFamily: theme.fonts.monoMedium },
  first: { backgroundColor: "#1d2220", borderRadius: 16, padding: 16, gap: 6 },
  workoutTitle: {
    color: theme.text,
    fontFamily: theme.fonts.display,
    fontSize: 26,
    lineHeight: 30,
    textTransform: "uppercase",
  },
  firstNote: { color: "#d4cfcc", fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18 },
  restList: { gap: 6 },
  restRow: {
    backgroundColor: "#1d2220",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  restActivity: { backgroundColor: "#241f21" },
  restTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 14, flexShrink: 1 },
  restWhen: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  backSpacer: { flex: 1 },
  back: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "#fff", fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  next: {
    flex: 2,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#e9b69b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  nextGo: { backgroundColor: "#fea06a" },
  nextText: { color: "#231c18", fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  nextGoText: { color: "#10201b" },
  toast: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#2f2a27",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
  },
  toastTitle: {
    color: "#e9b69b",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  toastBody: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
});
