import { useCallback, useEffect, useRef, useState } from "react";
import { PressableScale } from "@/components/pressable-scale";
import { AccessibilityInfo, Platform, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { G, Rect } from "react-native-svg";
import * as SplashScreen from "expo-splash-screen";

import { copy } from "@/copy";
import { haptic } from "@/haptic";
import { theme } from "@/theme";

/**
 * Clock from docs/design/splash-preview.html. The native launch screen is only
 * the page colour, so this view draws the bar and the plates begin at 0.55s.
 */
const PLATE_MS = 420;
const WORD_MS = 400;
const EXIT_MS = 350;
const DIP = 10;
const TRAVEL = 420;
const ICON = 304;
const VIEW = 1024;

const PLATE_EASE = Easing.bezier(0.2, 0.9, 0.25, 1.15);
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

const PLATES = [
  { x: 224, y: 292, width: 70, height: 440, rx: 26, fill: theme.green.accent, delay: 550, travel: -TRAVEL, land: false },
  { x: 730, y: 292, width: 70, height: 440, rx: 26, fill: theme.green.accent, delay: 550, travel: TRAVEL, land: true },
  { x: 154, y: 347, width: 58, height: 330, rx: 26, fill: theme.pink.accent, delay: 710, travel: -TRAVEL, land: false },
  { x: 812, y: 347, width: 58, height: 330, rx: 26, fill: theme.pink.accent, delay: 710, travel: TRAVEL, land: true },
  { x: 94, y: 397, width: 48, height: 230, rx: 24, fill: theme.fuel, delay: 870, travel: -TRAVEL, land: false },
  { x: 882, y: 397, width: 48, height: 230, rx: 24, fill: theme.fuel, delay: 870, travel: TRAVEL, land: true },
] as const;

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

let launchSplashArmed = true;
let splashShowing = false;
const splashWaiters: Array<() => void> = [];

/** True once per JS cold start. Backgrounding does not arm it again. */
export function claimLaunchSplash() {
  // Animated SVG plates pass translateY as a DOM prop on web and crash the splash,
  // which can leave a full-screen press layer over onboarding. Skip the splash on web.
  if (Platform.OS === "web") {
    launchSplashArmed = false;
    return false;
  }
  const show = launchSplashArmed;
  launchSplashArmed = false;
  if (show) splashShowing = true;
  return show;
}

/** Run after the launch splash has left. A later open in the same session runs now. */
export function afterLaunchSplash(run: () => void) {
  if (!splashShowing) run();
  else splashWaiters.push(run);
}

function settleLaunchSplash() {
  if (!splashShowing) return;
  splashShowing = false;
  const waiting = splashWaiters.splice(0);
  waiting.forEach((run) => run());
}

function Plate({
  spec,
  run,
  reduce,
  appReady,
  snap,
  onLand,
}: {
  spec: (typeof PLATES)[number];
  run: boolean;
  reduce: boolean;
  appReady: boolean;
  snap: SharedValue<number>;
  onLand: () => void;
}) {
  const progress = useSharedValue(0);
  const started = useRef(false);

  useEffect(() => {
    if (!run || started.current) return;
    if (reduce && !appReady) return;
    started.current = true;
    const duration = reduce ? WORD_MS : PLATE_MS;
    const delay = reduce ? 0 : spec.delay;
    const easing = reduce ? EASE : PLATE_EASE;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing }, (finished) => {
        if (finished && spec.land && !reduce) runOnJS(onLand)();
      }),
    );
  }, [appReady, onLand, progress, reduce, run, spec]);

  const animatedProps = useAnimatedProps(() => {
    const t = snap.value > 0 ? 1 : progress.value;
    const travel = reduce ? 0 : spec.travel;
    return {
      x: spec.x + travel * (1 - t),
      opacity: Math.min(1, Math.max(0, t)),
    };
  });

  return (
    <AnimatedRect
      animatedProps={animatedProps}
      y={spec.y}
      width={spec.width}
      height={spec.height}
      rx={spec.rx}
      fill={spec.fill}
      opacity={0}
    />
  );
}

export function LaunchSplash({ appReady, onDone }: { appReady: boolean; onDone: () => void }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [reduce, setReduce] = useState<boolean | null>(null);
  const [exitDue, setExitDue] = useState(false);
  const [wordShown, setWordShown] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const snap = useSharedValue(0);
  const dip = useSharedValue(0);
  const word = useSharedValue(0);
  const veil = useSharedValue(1);
  const startedAt = useRef<number | null>(null);
  const wordStarted = useRef(false);
  const exiting = useRef(false);
  const finished = useRef(false);
  const hidNative = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    settleLaunchSplash();
    onDoneRef.current();
  }, []);

  const skippedRef = useRef(false);
  const onLand = useCallback(() => {
    if (skippedRef.current) return;
    haptic.tap();
  }, []);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (live) setReduce(on);
      })
      .catch(() => {
        if (live) setReduce(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const run = reduce !== null && box.w > 0;
  if (run && startedAt.current === null) startedAt.current = Date.now();

  useEffect(() => {
    if (!run || reduce) return;
    dip.value = withDelay(
      1250,
      withSequence(
        withTiming(DIP, { duration: 175, easing: EASE }),
        withTiming(0, { duration: 325, easing: EASE }),
      ),
    );
  }, [dip, reduce, run]);

  useEffect(() => {
    if (!run || reduce || skipped) return;
    const timer = setTimeout(() => setExitDue(true), 2300);
    return () => clearTimeout(timer);
  }, [reduce, run, skipped]);

  useEffect(() => {
    if (!run || !reduce || !appReady || skipped) return;
    const timer = setTimeout(() => setExitDue(true), 650);
    return () => clearTimeout(timer);
  }, [appReady, reduce, run, skipped]);

  useEffect(() => {
    if (!run || !appReady || wordStarted.current || skipped) return;
    const elapsed = Date.now() - (startedAt.current ?? Date.now());
    const wordAt = reduce ? 0 : 1500;
    const wait = Math.max(0, wordAt - elapsed);
    const timer = setTimeout(() => {
      wordStarted.current = true;
      word.value = withTiming(1, { duration: WORD_MS, easing: EASE }, (done) => {
        if (done) runOnJS(setWordShown)(true);
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [appReady, reduce, run, skipped, word]);

  useEffect(() => {
    if (skipped || !exitDue || !wordShown || !appReady || exiting.current) return;
    exiting.current = true;
    veil.value = withTiming(0, { duration: EXIT_MS, easing: EASE }, (done) => {
      if (done) runOnJS(finish)();
    });
  }, [appReady, exitDue, finish, skipped, veil, wordShown]);

  useEffect(() => {
    if (skipped && appReady) finish();
  }, [appReady, finish, skipped]);

  const groupProps = useAnimatedProps(() => ({
    translateY: snap.value > 0 ? 0 : dip.value,
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: Math.max(word.value, snap.value),
  }));

  const veilStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
  }));

  function skip() {
    if (finished.current) return;
    skippedRef.current = true;
    snap.value = 1;
    dip.value = 0;
    word.value = 1;
    setSkipped(true);
  }

  function onSplashLayout(event: LayoutChangeEvent) {
    const { width: w, height: h } = event.nativeEvent.layout;
    if (w !== box.w || h !== box.h) setBox({ w, h });
  }

  useEffect(() => {
    if (box.w <= 0 || hidNative.current) return;
    hidNative.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        SplashScreen.hideAsync().catch(() => {});
      });
    });
  }, [box.w]);

  const unit = ICON / VIEW;
  const vbW = box.w / unit;
  const vbH = box.h / unit;
  const viewBox = `${(VIEW - vbW) / 2} ${(VIEW - vbH) / 2} ${vbW} ${vbH}`;
  const leftPlates = PLATES.filter((spec) => spec.travel < 0);
  const rightPlates = PLATES.filter((spec) => spec.travel > 0);

  return (
    <Animated.View style={[styles.fill, veilStyle]} onLayout={onSplashLayout} pointerEvents="box-none">
      <PressableScale
        kind="plain"
        style={styles.fill}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel={copy.workout.skip}
      >
        {box.w > 0 && box.h > 0 ? (
          <Svg width={box.w} height={box.h} viewBox={viewBox}>
            <AnimatedG animatedProps={groupProps}>
              <Rect x={96} y={494} width={832} height={36} rx={18} fill={theme.orange.accent} />
              <Rect x={302} y={452} width={28} height={120} rx={12} fill={theme.text} />
              {leftPlates.map((spec) => (
                <Plate key={spec.x} spec={spec} run={run} reduce={!!reduce} appReady={appReady} snap={snap} onLand={onLand} />
              ))}
              <Rect x={694} y={452} width={28} height={120} rx={12} fill={theme.text} />
              {rightPlates.map((spec) => (
                <Plate key={spec.x} spec={spec} run={run} reduce={!!reduce} appReady={appReady} snap={snap} onLand={onLand} />
              ))}
            </AnimatedG>
          </Svg>
        ) : null}
        <Animated.Text style={[styles.word, appReady && styles.wordFont, wordStyle]} accessible={false}>
          {copy.workout.liftBoard}
        </Animated.Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.orange.background,
  },
  word: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "30%",
    textAlign: "center",
    fontSize: 34,
    color: theme.text,
    letterSpacing: 34 * 0.02,
  },
  wordFont: {
    fontFamily: theme.fonts.display,
  },
});
