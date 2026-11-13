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
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Reanimated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { BottomToast } from "@/components/motion";
import { ageDial, bodyFatDial, DialValue, heightDial, stepsDial, weightDial, type DialSpec } from "@/components/number-dial";
import { copy } from "@/copy";
import { haptic } from "@/haptic";
import { ArrowRight, CheckCircle, Fuel, Info, TabWorkouts } from "@/icons";
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
  usesKg,
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

const PILL_HOLD = 2800;
const PILL_FADE = 700;
const PILL_EASE = Easing.bezier(0.42, 0, 0.58, 1);

/** One example fades out as the other fades in, on a 7s loop. `start` waits before the first fade. */
function useSwapOpacity(start: number, reduce: boolean) {
  const lead = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) {
      lead.setValue(1);
      return;
    }
    const fade = (to: number) =>
      Animated.timing(lead, { toValue: to, duration: PILL_FADE, easing: PILL_EASE, useNativeDriver: nativeDriver });
    const cycle = Animated.loop(
      Animated.sequence([Animated.delay(PILL_HOLD), fade(0), Animated.delay(PILL_HOLD), fade(1)]),
    );
    const wait = setTimeout(() => cycle.start(), start);
    return () => {
      clearTimeout(wait);
      cycle.stop();
      lead.setValue(1);
    };
  }, [lead, reduce, start]);
  const follow = lead.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return [lead, reduce ? lead.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }) : follow] as const;
}

function PillSlot({
  texts,
  opacities,
  tint,
}: {
  texts: readonly [string, string];
  opacities: readonly [
    Animated.AnimatedInterpolation<number> | Animated.Value,
    Animated.AnimatedInterpolation<number> | Animated.Value,
  ];
  tint?: string;
}) {
  const [width, setWidth] = useState(0);
  const grow = (next: number) => setWidth((current) => (next > current ? next : current));
  const tintStyle = tint ? { color: tint, backgroundColor: `${tint}38` } : null;
  return (
    <View style={[styles.slot, width ? { width } : null]}>
      {texts.map((text, index) => (
        <Animated.Text
          key={text}
          onLayout={(event) => grow(event.nativeEvent.layout.width)}
          numberOfLines={1}
          style={[styles.chip, tintStyle, index === 1 && styles.slotOver, { opacity: opacities[index] }]}
        >
          {text}
        </Animated.Text>
      ))}
    </View>
  );
}

function ExampleLever({
  color,
  pairs,
  reduce,
  delay,
}: {
  color: string;
  pairs: readonly (readonly [string, string])[];
  reduce: boolean;
  /** How far this card sits behind the first card's pill cycle. */
  delay: number;
}) {
  const cause = useSwapOpacity(delay, reduce);
  const result = useSwapOpacity(delay + 450, reduce);
  const label = pairs.map((item) => `${item[0]}. ${item[1]}`).join(". ");
  return (
    <View accessibilityLabel={label} style={styles.lever}>
      <PillSlot texts={[pairs[0][0], pairs[1][0]]} opacities={cause} />
      <ArrowRight size={14} color={theme.muted} />
      <PillSlot texts={[pairs[0][1], pairs[1][1]]} opacities={result} tint={color} />
    </View>
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
        icon={<TabWorkouts size={28} color="#6fd0b4" />}
        title={o.liftToday}
        body={o.liftTodayBody}
        lever={
          <ExampleLever
            color="#6fd0b4"
            reduce={reduce}
            delay={0}
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
        icon={<CheckCircle size={28} color="#fc96bf" />}
        title={o.fits}
        body={o.fitsBody}
        lever={
          <ExampleLever
            color="#fc96bf"
            reduce={reduce}
            delay={800}
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
        icon={<Fuel size={28} color="#fea06a" />}
        title={o.fuelRecover}
        body={o.fuelRecoverBody}
        lever={
          <ExampleLever
            color="#fea06a"
            reduce={reduce}
            delay={1600}
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
  onTouch,
}: {
  value: 0 | 1 | 2;
  onChange: (level: 0 | 1 | 2) => void;
  onTouch: () => void;
}) {
  const reduce = useReduceMotion();
  const pos = useRef(new Animated.Value(value)).current;
  const posRef = useRef<number>(value);
  const dragging = useRef(false);
  const [track, setTrack] = useState(0);

  useEffect(() => {
    const id = pos.addListener(({ value: next }) => {
      posRef.current = next;
    });
    return () => pos.removeListener(id);
  }, [pos]);

  const glide = useCallback(
    (to: number) => {
      pos.stopAnimation();
      if (reduce) {
        pos.setValue(to);
        return;
      }
      Animated.timing(pos, {
        toValue: to,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [pos, reduce],
  );

  useEffect(() => {
    if (dragging.current) return;
    if (Math.abs(posRef.current - value) < 0.001) return;
    glide(value);
  }, [glide, value]);

  const travel = Math.max(track - 28, 0);
  const left = pos.interpolate({ inputRange: [0, 2], outputRange: [0, travel] });

  const place = (x: number) => {
    if (track <= 28) return;
    const center = Math.min(track - 14, Math.max(14, x));
    const next = ((center - 14) / (track - 28)) * 2;
    pos.setValue(next);
    const level = Math.round(next) as 0 | 1 | 2;
    if (level !== value) onChange(level);
  };

  const grab = useRef(value);
  const settle = () => {
    dragging.current = false;
    const level = Math.max(0, Math.min(2, Math.round(posRef.current))) as 0 | 1 | 2;
    if (level !== grab.current) haptic.selection();
    if (level !== value) onChange(level);
    glide(level);
  };

  return (
    <View style={styles.sliderBlock}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={copy.you.experience}
        accessibilityValue={{ min: 0, max: 2, now: value, text: LEVEL_NAMES[value] }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          onTouch();
          const next =
            event.nativeEvent.actionName === "increment"
              ? (Math.min(2, value + 1) as 0 | 1 | 2)
              : event.nativeEvent.actionName === "decrement"
                ? (Math.max(0, value - 1) as 0 | 1 | 2)
                : value;
          if (next !== value) haptic.selection();
          onChange(next);
        }}
        onLayout={(event) => setTrack(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          dragging.current = true;
          grab.current = value;
          pos.stopAnimation();
          onTouch();
          place(event.nativeEvent.locationX);
        }}
        onResponderMove={(event) => place(event.nativeEvent.locationX)}
        onResponderRelease={settle}
        onResponderTerminate={settle}
        style={styles.sliderHit}
      >
        <View style={styles.sliderTrack}>
          <View style={styles.sliderGradient}>
            {Array.from({ length: 24 }, (_, index) => (
              <View key={index} style={{ flex: 1, backgroundColor: mix("#6fd0b4", "#e9b69b", index / 23) }} />
            ))}
          </View>
        </View>
        <Animated.View pointerEvents="none" style={[styles.thumb, { left }]} />
      </View>
      <View style={styles.levelNames}>
        {LEVEL_NAMES.map((name, index) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityState={{ selected: value === index }}
            onPress={() => {
              onTouch();
              if (index !== value) haptic.selection();
              onChange(index as 0 | 1 | 2);
            }}
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

function LevelDemo({
  level,
  onChange,
  onTouch,
}: {
  level: 0 | 1 | 2;
  onChange: (level: 0 | 1 | 2) => void;
  onTouch: () => void;
}) {
  const o = copy.onboarding;
  const showTip = level === 0;
  const showWhy = level === 0;
  const showSwap = level === 2;
  const showRest = level !== 2;
  return (
    <View>
      <LevelSlider value={level} onChange={onChange} onTouch={onTouch} />
      <View accessibilityLiveRegion="polite" style={styles.demo}>
        <View style={styles.demoTop}>
          <Text style={styles.demoEye}>{o.dayOneLower}</Text>
          <Text style={styles.demoMode}>{LEVEL_MODES[level]}</Text>
        </View>
        {showTip ? (
          <View style={styles.tip}>
            <Info size={16} color="#6fd0b4" />
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
              onPress={() => {
                haptic.selection();
                onPress(item.id);
              }}
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
            onPress={() => {
              haptic.selection();
              onPress(item.id);
            }}
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
        onPress={() => {
          haptic.selection();
          onToggle();
        }}
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
              onPress={() => {
                haptic.selection();
                onCount(row.id, row.kind, -1);
              }}
              style={styles.stepperButton}
            >
              <Text style={styles.stepperSymbol}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{row.value}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={o.more(row.name)}
              onPress={() => {
                haptic.selection();
                onCount(row.id, row.kind, 1);
              }}
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

function DialField({
  label,
  value,
  spec,
  placeholder,
  start,
  onChange,
}: {
  label: string;
  value: string;
  spec: DialSpec;
  placeholder?: string;
  start?: number;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <DialValue
        label={label}
        value={value}
        placeholder={placeholder}
        spec={spec}
        start={start}
        onChange={onChange}
        style={styles.input}
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
  const kg = usesKg();
  return (
    <View style={styles.stack}>
      <SexPills sex={draft.sex} onPress={onSex} />
      <View style={styles.fields}>
        <DialField label={o.age} value={draft.age} spec={ageDial} onChange={(value) => onBio("age", value)} />
        <DialField label={o.height} value={draft.height} spec={heightDial} onChange={(value) => onBio("height", value)} />
        <DialField
          label={o.weight(weightUnit())}
          value={toDisplayWeight(draft.weight)}
          spec={weightDial(kg)}
          onChange={(value) => onBio("weight", fromDisplayWeight(value))}
        />
        <DialField
          label={o.bodyFat}
          value={draft.bodyFat}
          placeholder={o.optional}
          spec={bodyFatDial}
          onChange={(value) => onBio("bodyFat", value)}
        />
        <DialField
          label={o.dailySteps}
          value={draft.steps}
          placeholder={o.stepsExample}
          spec={stepsDial}
          start={draft.steps.trim() ? undefined : Number(o.stepsExample.replace(/[^\d]/g, "")) || undefined}
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

const FIRST_MS = 260;
const DAY_MS = 200;

function landingGap(count: number) {
  if (count <= 1) return 80;
  const room = 1150 - FIRST_MS - DAY_MS;
  return Math.min(80, Math.max(32, Math.floor(room / (count - 1))));
}

function WeekDrop({
  reduce,
  delay,
  duration,
  fromY,
  fromScale,
  onLand,
  style,
  children,
}: {
  reduce: boolean;
  delay: number;
  duration: number;
  fromY: number;
  fromScale: number;
  onLand: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const opacity = useSharedValue(0);
  const y = useSharedValue(reduce ? 0 : fromY);
  const scale = useSharedValue(reduce ? 1 : fromScale);
  const landRef = useRef(onLand);
  landRef.current = onLand;
  useEffect(() => {
    const ms = reduce ? 160 : duration;
    opacity.value = withDelay(delay, withTiming(1, { duration: ms }));
    if (!reduce) {
      y.value = withDelay(delay, withTiming(0, { duration: ms }));
      scale.value = withDelay(delay, withTiming(1, { duration: ms }));
    }
    const timer = setTimeout(() => landRef.current(), delay + ms);
    return () => clearTimeout(timer);
  }, [delay, duration, opacity, reduce, scale, y]);
  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { scale: scale.value }],
  }));
  return <Reanimated.View style={[style, anim]}>{children}</Reanimated.View>;
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
                onTouch={() => change((item) => (item.demoTouched ? item : { ...item, demoTouched: true }))}
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
                  haptic.selection();
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
          <BottomToast
            lines={[toast.title, toast.body]}
            bottom={88}
            pulse={false}
            variant="plan"
            onDismiss={() => setToast(null)}
          />
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
  const gap = landingGap(workout.rest.length);
  const total = 1 + workout.rest.length;
  const fired = useRef(new Set<number>());
  const land = (index: number) => {
    if (fired.current.has(index)) return;
    fired.current.add(index);
    if (index === total - 1) haptic.success();
    else haptic.tap();
  };
  return (
    <View style={styles.stack}>
      <WeekDrop
        reduce={reduce}
        delay={0}
        duration={FIRST_MS}
        fromY={0}
        fromScale={0.96}
        onLand={() => land(0)}
        style={styles.first}
      >
        <Text style={styles.weye}>{workout.eyebrow}</Text>
        <Text style={styles.workoutTitle}>{workout.title}</Text>
        <Text style={styles.firstNote}>{copy.onboarding.startingWeights}</Text>
      </WeekDrop>
      <View style={styles.restList}>
        {workout.rest.map((item, index) => (
          <WeekDrop
            key={item.key}
            reduce={reduce}
            delay={FIRST_MS + index * gap}
            duration={DAY_MS}
            fromY={12}
            fromScale={1}
            onLand={() => land(index + 1)}
            style={[styles.restRow, item.activity && styles.restActivity]}
          >
            <Text style={styles.restTitle}>{item.title}</Text>
            <Text style={styles.restWhen}>{item.when}</Text>
          </WeekDrop>
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
  lever: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 },
  slot: { alignSelf: "flex-start" },
  slotOver: { position: "absolute", left: 0, top: 0 },
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
