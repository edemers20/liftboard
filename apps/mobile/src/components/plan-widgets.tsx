import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewInstance,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { copy } from "@/copy";
import { theme } from "@/theme";
import { useReduceMotion } from "@/use-reduce-motion";

export const planColors = {
  line: "#393330",
  div: "#433d39",
  card: "#2f2a27",
  warn: "#3a3018",
  doneDot: "#5e5652",
  liftOn: "#2f3a35",
  actOn: "#2a1f25",
  sentence: "#d4cfcc",
  peachTint: "rgba(233,182,155,0.18)",
  greenTint: "rgba(111,208,180,0.16)",
  white: "#ffffff",
  ink: "#231c18",
};

export type InfoBlock = { label: string; body: string };

export function Eyebrow({ title, info }: { title: string; info?: readonly InfoBlock[] }) {
  return (
    <View style={styles.eyebrowRow}>
      <Text style={styles.eyebrow}>{title}</Text>
      {info ? <InfoButton sections={info} /> : null}
    </View>
  );
}

export function InfoButton({ sections }: { sections: readonly InfoBlock[] }) {
  const reduceMotion = useReduceMotion();
  const ref = useRef<ViewInstance>(null);
  const screen = useWindowDimensions();
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const open = anchor != null;
  useFocusEffect(
    useCallback(() => {
      return () => setAnchor(null);
    }, []),
  );

  function toggle() {
    if (open) {
      setAnchor(null);
      return;
    }
    ref.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
  }

  const width = Math.min(300, screen.width - 32);
  const estimated = 28 + sections.length * 72;
  let top = anchor ? anchor.y + anchor.h + 8 : 0;
  if (anchor && top + estimated > screen.height - 16) top = Math.max(16, anchor.y - estimated - 8);
  const left = anchor
    ? Math.max(16, Math.min(screen.width - width - 16, anchor.x + anchor.w / 2 - width / 2))
    : 16;

  return (
    <>
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={copy.plan.whatThisDoes}
        accessibilityState={{ expanded: open }}
        hitSlop={13}
        onPress={toggle}
        style={[styles.info, open && styles.infoOn]}
      >
        <Text style={[styles.infoGlyph, open && styles.infoGlyphOn]}>i</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType={reduceMotion ? "none" : "fade"}
        onRequestClose={() => setAnchor(null)}
      >
        <View style={styles.fill}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnchor(null)} />
          <View style={[styles.pop, { width, left, top }]}>
            {sections.map((section) => (
              <Text key={section.label} style={styles.popBody}>
                <Text style={styles.popLabel}>{section.label}: </Text>
                {section.body}
              </Text>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

type Choice = { value: string; label: string };

export function ChoicePills({
  label,
  options,
  value,
  onChange,
  tone,
  layout,
  numeric,
}: {
  label?: string;
  options: readonly Choice[];
  value: string;
  onChange: (value: string) => void;
  tone: "fill" | "peach" | "green";
  layout: "wrap" | "pair" | "triple";
  numeric?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.pills, layout === "wrap" ? styles.pillsWrap : styles.pillsGrid]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            aria-checked={selected}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.pill,
              tone === "fill" ? styles.pillFill : styles.pillRound,
              layout === "pair" && styles.pillPair,
              layout === "triple" && styles.pillTriple,
              selected && (tone === "peach" ? styles.peachOn : tone === "green" ? styles.greenOn : styles.fillOn),
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                numeric ? styles.pillMono : null,
                selected && (numeric ? styles.pillMonoOn : styles.pillTextOn),
                selected && tone === "peach" && styles.peachText,
                selected && tone === "green" && styles.greenText,
                selected && tone === "fill" && styles.fillText,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      aria-checked={on}
      onPress={() => onChange(!on)}
      style={styles.toggleRow}
    >
      <Text style={styles.toggleLabel} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <View style={[styles.track, on && styles.trackOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

export function DayPicker({
  selected,
  tone,
  onToggle,
}: {
  selected: number[];
  tone: "lift" | "activity";
  onToggle: (index: number) => void;
}) {
  return (
    <View style={styles.days}>
      {copy.plan.dayLetters.split("").map((letter, index) => {
        const on = selected.includes(index);
        return (
          <Pressable
            key={copy.plan.weekdays[index]}
            accessibilityRole="button"
            accessibilityLabel={copy.plan.weekdays[index]}
            accessibilityState={{ selected: on }}
            aria-pressed={on}
            onPress={() => onToggle(index)}
            style={({ pressed }) => [
              styles.day,
              on && (tone === "lift" ? styles.dayLift : styles.dayAct),
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.dayText, on && (tone === "lift" ? styles.dayLiftText : styles.dayActText)]}>
              {letter}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatusMark({ status }: { status: "done" | "next" | "open" }) {
  if (status === "next") {
    return (
      <View style={[styles.mark, styles.markNext]}>
        <View style={styles.chevron} />
      </View>
    );
  }
  if (status === "done") {
    return (
      <View style={[styles.mark, styles.markDone]}>
        <View style={styles.check} />
      </View>
    );
  }
  return <View style={[styles.mark, styles.markOpen]} />;
}

export function Notice({ lines, onDismiss }: { lines: string[]; onDismiss: () => void }) {
  if (!lines.length) return null;
  return (
    <Pressable accessibilityRole="alert" onPress={onDismiss} style={styles.notice}>
      <Text style={styles.noticeTitle}>{lines[0]}</Text>
      {lines.slice(1).map((line, index) => (
        <Text key={`${index}-${line}`} style={index === 0 ? styles.noticeStrong : styles.noticeBody}>
          {line}
        </Text>
      ))}
    </Pressable>
  );
}

export function ConfirmCard({
  title,
  body,
  confirm,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <Modal visible transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={onCancel}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.dialogWrap} pointerEvents="box-none">
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text style={styles.dialogTitle}>{title}</Text>
            <Text style={styles.dialogBody}>{body}</Text>
            <View style={styles.dialogButtons}>
              <Pressable accessibilityRole="button" onPress={onCancel} style={styles.secondary}>
                <Text style={styles.secondaryText}>{copy.plan.cancel}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onConfirm} style={styles.primary}>
                <Text style={styles.primaryText}>{confirm}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function panelStyle(): StyleProp<ViewStyle> {
  return styles.panel;
}

export function fieldLabelStyle(): StyleProp<TextStyle> {
  return styles.fieldLabel;
}

export function noteStyle(): StyleProp<TextStyle> {
  return styles.note;
}

export function linkStyle(): StyleProp<TextStyle> {
  return styles.link;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  eyebrow: {
    color: theme.orange.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
  },
  info: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: planColors.line,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  infoOn: { backgroundColor: theme.orange.accent },
  infoGlyph: {
    color: planColors.sentence,
    fontFamily: theme.fonts.monoMedium,
    fontSize: 11,
    lineHeight: 14,
  },
  infoGlyphOn: { color: planColors.ink },
  pop: {
    position: "absolute",
    backgroundColor: planColors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  popBody: { color: planColors.white, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 19 },
  popLabel: { color: theme.orange.accent, fontFamily: theme.fonts.bodySemi },
  pills: { gap: 8 },
  pillsWrap: { flexDirection: "row", flexWrap: "wrap" },
  pillsGrid: { flexDirection: "row", flexWrap: "wrap" },
  pill: {
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.orange.background,
  },
  pillFill: { borderRadius: 12 },
  pillRound: { borderRadius: theme.radii.pill, paddingHorizontal: 8 },
  pillPair: { width: "48%" },
  pillTriple: { flexGrow: 1, flexBasis: "30%" },
  peachOn: { backgroundColor: planColors.peachTint },
  greenOn: { backgroundColor: planColors.greenTint },
  fillOn: { backgroundColor: theme.orange.selectedFill },
  pressed: { opacity: 0.72 },
  pillText: {
    color: theme.text,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    textAlign: "center",
  },
  pillTextOn: { fontFamily: theme.fonts.bodySemi },
  pillMono: { fontFamily: theme.fonts.mono, fontSize: 13 },
  pillMonoOn: { fontFamily: theme.fonts.monoMedium },
  peachText: { color: theme.orange.accent },
  greenText: { color: theme.green.accent },
  fillText: { color: planColors.white },
  toggleRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleLabel: { flex: 1, color: theme.text, fontFamily: theme.fonts.body, fontSize: 16 },
  track: {
    width: 52,
    height: 32,
    borderRadius: theme.radii.pill,
    backgroundColor: planColors.line,
    justifyContent: "center",
  },
  trackOn: { backgroundColor: theme.orange.selectedFill },
  knob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.text,
    marginLeft: 3,
  },
  knobOn: { marginLeft: 23, backgroundColor: planColors.white },
  days: { flexDirection: "row", gap: 4 },
  day: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: theme.orange.background,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLift: { backgroundColor: planColors.liftOn },
  dayAct: { backgroundColor: planColors.actOn },
  dayText: { color: theme.muted, fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  dayLiftText: { color: theme.green.accent },
  dayActText: { color: theme.pink.accent },
  mark: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  markNext: { backgroundColor: theme.green.accent },
  markDone: { backgroundColor: planColors.line },
  markOpen: { borderWidth: 1.5, borderColor: planColors.div },
  chevron: {
    width: 6,
    height: 6,
    marginLeft: -2,
    borderTopWidth: 1.8,
    borderRightWidth: 1.8,
    borderColor: theme.orange.background,
    transform: [{ rotate: "45deg" }],
  },
  check: {
    width: 8,
    height: 5,
    marginTop: -2,
    borderLeftWidth: 1.8,
    borderBottomWidth: 1.8,
    borderColor: theme.muted,
    transform: [{ rotate: "-50deg" }],
  },
  notice: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 12,
    backgroundColor: planColors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    zIndex: 5,
  },
  noticeTitle: {
    color: theme.orange.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
  },
  noticeStrong: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  noticeBody: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 20 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.6)" },
  dialogWrap: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  dialog: {
    backgroundColor: theme.orange.surface,
    borderRadius: theme.radii.card,
    padding: 16,
    gap: 12,
  },
  dialogTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 17 },
  dialogBody: { color: planColors.sentence, fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 21 },
  dialogButtons: { flexDirection: "row", gap: 8 },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: theme.orange.selectedFill,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: planColors.white, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  panel: {
    backgroundColor: theme.orange.surface,
    borderRadius: theme.radii.card,
    padding: 14,
    gap: 12,
  },
  fieldLabel: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  note: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18 },
  link: { color: theme.orange.accent, fontFamily: theme.fonts.bodySemi, fontSize: 14 },
});
