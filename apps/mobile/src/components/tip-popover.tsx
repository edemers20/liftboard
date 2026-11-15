import { useEffect, useRef, useSyncExternalStore } from "react";
import { PressableScale } from "@/components/pressable-scale";
import { usePathname } from "expo-router";
import { Modal, PanResponder, ScrollView, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";

import { Info } from "@/icons";
import { theme } from "@/theme";
import { useReduceMotion } from "@/use-reduce-motion";

export type TipSection = { label?: string; body: string };

type Anchor = { x: number; y: number; width: number; height: number };

type Tip = {
  id: number;
  anchor: Anchor;
  sections: readonly TipSection[];
};

const CARD = "#2f2a27";
const WIDTH = 280;

let tip: Tip | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function closeTip() {
  if (!tip) return;
  tip = null;
  emit();
}

function openTip(id: number, anchor: Anchor, sections: readonly TipSection[]) {
  tip = { id, anchor, sections };
  emit();
}

function currentTip() {
  return tip;
}

/** One tip at a time. Anchored to the (i), with a pointer. No dimmed sheet. */
export function InfoTip({
  sections,
  label,
  color = "#d4cfcc",
  activeColor = theme.orange.accent,
  style,
}: {
  sections: readonly TipSection[];
  label: string;
  color?: string;
  activeColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<any>(null);
  const id = useRef(0);
  if (id.current === 0) id.current = nextId++;
  const open = useSyncExternalStore(subscribe, () => tip?.id === id.current, () => false);

  function toggle() {
    if (open) {
      closeTip();
      return;
    }
    ref.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      openTip(id.current, { x, y, width, height }, sections);
    });
  }

  return (
    <PressableScale
      kind="text"
      ref={ref}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      hitSlop={13}
      onPress={toggle}
      style={style}
    >
      <Info size={16} color={open ? activeColor : color} />
    </PressableScale>
  );
}

export function TipHost() {
  const reduceMotion = useReduceMotion();
  const pathname = usePathname();
  const open = useSyncExternalStore(subscribe, currentTip, () => null);

  useEffect(() => {
    closeTip();
  }, [pathname]);

  return (
    <Modal
      visible={open != null}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={closeTip}
      statusBarTranslucent
    >
      {open ? <TipCard tip={open} /> : null}
    </Modal>
  );
}

function TipCard({ tip: open }: { tip: Tip }) {
  const screen = useWindowDimensions();
  const width = Math.min(WIDTH, screen.width - 32);
  const chars = open.sections.reduce((sum, section) => sum + (section.label?.length ?? 0) + section.body.length, 0);
  const estimated = Math.min(screen.height * 0.55, 36 + open.sections.length * 22 + Math.ceil(chars / 36) * 19);
  const belowTop = open.anchor.y + open.anchor.height + 8;
  const placeBelow = belowTop + estimated <= screen.height - 16;
  const top = placeBelow ? belowTop : Math.max(16, open.anchor.y - estimated - 8);
  const left = Math.max(16, Math.min(screen.width - width - 16, open.anchor.x + open.anchor.width / 2 - width / 2));
  const pointerLeft = Math.max(14, Math.min(width - 30, open.anchor.x + open.anchor.width / 2 - left - 8));
  const box = useRef({ x: left, y: top, w: width, h: estimated });
  box.current = { x: left, y: top, w: width, h: estimated };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (event, gesture) => {
        if (Math.abs(gesture.dx) < 8 && Math.abs(gesture.dy) < 8) return false;
        const { pageX, pageY } = event.nativeEvent;
        const card = box.current;
        const onCard = pageX >= card.x && pageX <= card.x + card.w && pageY >= card.y && pageY <= card.y + card.h;
        return !onCard;
      },
      onPanResponderMove: () => closeTip(),
    }),
  ).current;

  return (
    <View style={styles.fill} {...pan.panHandlers}>
      <PressableScale kind="plain" accessibilityRole="button" onPress={closeTip} style={StyleSheet.absoluteFill} />
      <View style={[styles.anchor, { left, top, width }]}>
        {placeBelow ? <Pointer style={{ left: pointerLeft, top: -8 }} up /> : null}
        <View accessibilityViewIsModal style={styles.card}>
          <ScrollView bounces={false} style={{ maxHeight: estimated }}>
            {open.sections.map((section, index) => (
              <View key={`${section.label ?? "tip"}-${index}`} style={index > 0 ? styles.block : null}>
                {section.label ? <Text style={styles.label}>{section.label}</Text> : null}
                <Text style={styles.body}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
        {placeBelow ? null : <Pointer style={{ left: pointerLeft, bottom: -8 }} />}
      </View>
    </View>
  );
}

function Pointer({ up, style }: { up?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[up ? styles.pointerUp : styles.pointerDown, style]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  anchor: { position: "absolute" },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  block: { marginTop: 10 },
  label: { fontFamily: theme.fonts.bodySemi, fontSize: 13, lineHeight: 18, color: theme.orange.accent },
  body: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 19, color: theme.text },
  pointerUp: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: CARD,
  },
  pointerDown: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: CARD,
  },
});
