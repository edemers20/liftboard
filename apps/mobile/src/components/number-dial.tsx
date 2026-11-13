import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetFrame } from "@/components/motion";
import { copy } from "@/copy";
import { Close } from "@/icons";
import { theme } from "@/theme";
import { useReduceMotion } from "@/use-reduce-motion";

const ITEM = 40;
const PAD = 80;

export type DialSpec = {
  min: number;
  max: number;
  step: number;
  unit?: string;
  optional?: boolean;
  start?: number;
};

type Request = DialSpec & {
  label: string;
  value: string;
  accent: string;
  onCommit: (value: string) => void;
  /** Line under the wheel. Called with the highlighted amount. */
  detail?: (shown: string) => ReactNode;
};

const DialContext = createContext<(request: Request) => void>(() => {});

export function weightDial(kg: boolean): DialSpec {
  return kg
    ? { min: 30, max: 180, step: 0.1, unit: copy.you.kg }
    : { min: 70, max: 400, step: 0.5, unit: copy.you.lb };
}

export function avgWeightDial(kg: boolean): DialSpec {
  return { ...weightDial(kg), step: kg ? 0.1 : 0.2, optional: true };
}

export function liftWeightDial(kg: boolean): DialSpec {
  return kg
    ? { min: 0, max: 270, step: 0.5, unit: copy.you.kg }
    : { min: 0, max: 600, step: 2.5, unit: copy.you.lb };
}

export const ageDial: DialSpec = { min: 13, max: 90, step: 1 };
export const heightDial: DialSpec = { min: 48, max: 84, step: 1 };
export const stepsDial: DialSpec = { min: 0, max: 30000, step: 250 };
export const bodyFatDial: DialSpec = { min: 5, max: 50, step: 1, unit: "%", optional: true, start: 25 };
export const shareDial: DialSpec = { min: 0, max: 100, step: 5, unit: "%" };
export const repsDial: DialSpec = { min: 0, max: 40, step: 1 };

export function DialHost({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  return (
    <DialContext.Provider value={setRequest}>
      {children}
      {request ? <NumberDial request={request} onClose={() => setRequest(null)} /> : null}
    </DialContext.Provider>
  );
}

export function DialValue({
  label,
  accessibilityLabel,
  value,
  placeholder,
  spec,
  start,
  accent = theme.orange.selectedFill,
  onChange,
  detail,
  style,
  textStyle,
}: {
  label: string;
  accessibilityLabel?: string;
  value: string;
  placeholder?: string;
  spec: DialSpec;
  start?: number;
  accent?: string;
  onChange: (value: string) => void;
  detail?: (shown: string) => ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const open = useContext(DialContext);
  const shown = value.trim();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={shown || placeholder}
      onPress={() =>
        open({
          ...spec,
          label,
          value: shown,
          start: start ?? spec.start,
          accent,
          onCommit: onChange,
          detail,
        })
      }
      style={[styles.valueBox, style]}
    >
      <Text style={[styles.valueText, textStyle, !shown && styles.placeholder]} numberOfLines={1}>
        {shown || placeholder || " "}
      </Text>
    </Pressable>
  );
}

function valuesOf(spec: DialSpec) {
  const out: (number | null)[] = spec.optional ? [null] : [];
  const count = Math.round((spec.max - spec.min) / spec.step);
  for (let i = 0; i <= count; i++) out.push(+(spec.min + i * spec.step).toFixed(4));
  return out;
}

function formatValue(value: number, step: number) {
  const decimals = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  return decimals ? String(+value.toFixed(decimals)) : String(Math.round(value));
}

function indexFor(vals: (number | null)[], value: string, start?: number) {
  const current = parseFloat(value);
  const target = Number.isFinite(current) ? current : start;
  if (target == null || !Number.isFinite(target)) return 0;
  let best = Infinity;
  let index = 0;
  vals.forEach((item, i) => {
    if (item != null && Math.abs(item - target) < best) {
      best = Math.abs(item - target);
      index = i;
    }
  });
  return index;
}

function NumberDial({ request, onClose }: { request: Request; onClose: () => void }) {
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const vals = valuesOf(request);
  const startIndex = indexFor(vals, request.value, request.start);
  const [index, setIndex] = useState(startIndex);
  const list = useRef<FlatList<(number | null)>>(null);
  const indexRef = useRef(startIndex);

  function move(next: number, animated: boolean) {
    const clamped = Math.max(0, Math.min(vals.length - 1, next));
    indexRef.current = clamped;
    setIndex(clamped);
    list.current?.scrollToOffset({ offset: clamped * ITEM, animated });
  }

  function settle(offset: number) {
    move(Math.round(offset / ITEM), false);
  }

  const current = vals[index];
  const spoken = current == null ? copy.you.none : `${formatValue(current, request.step)}${request.unit ? ` ${request.unit}` : ""}`;

  return (
    <SheetFrame visible onClose={onClose} label={copy.you.cancel}>
        <View style={[styles.sheet, { marginBottom: insets.bottom + 12 }]}>
          <View style={styles.top}>
            <Text style={styles.label}>{request.label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.you.cancel} onPress={onClose} style={styles.close}>
              <Close />
            </Pressable>
          </View>
          <View style={styles.wheelWrap}>
            <View pointerEvents="none" style={styles.band} />
            <FlatList
              ref={list}
              data={vals}
              keyExtractor={(_, i) => String(i)}
              style={styles.wheel}
              ListHeaderComponent={<View style={styles.pad} />}
              ListFooterComponent={<View style={styles.pad} />}
              snapToInterval={ITEM}
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              initialNumToRender={12}
              getItemLayout={(_, i) => ({ length: ITEM, offset: PAD + i * ITEM, index: i })}
              onLayout={() => list.current?.scrollToOffset({ offset: startIndex * ITEM, animated: false })}
              onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.y)}
              onScrollEndDrag={(event) => {
                const speed = Math.abs(event.nativeEvent.velocity?.y ?? 0);
                if (speed < 0.05) settle(event.nativeEvent.contentOffset.y);
              }}
              accessibilityRole="adjustable"
              accessibilityLabel={request.label}
              accessibilityValue={{ text: spoken }}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={(event) => move(indexRef.current + (event.nativeEvent.actionName === "increment" ? 1 : -1), !reduceMotion)}
              renderItem={({ item, index: itemIndex }) => {
                const on = itemIndex === index;
                const text = item == null ? copy.you.none : formatValue(item, request.step);
                return (
                  <Pressable accessibilityRole="button" accessibilityLabel={item == null ? text : `${text} ${request.unit ?? ""}`.trim()} onPress={() => move(itemIndex, !reduceMotion)} style={styles.item}>
                    <Text style={[styles.itemText, on && styles.itemOn]}>
                      {text}
                      {item != null && request.unit ? <Text style={[styles.unit, on && styles.unitOn]}> {request.unit}</Text> : null}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
          {request.detail && current != null ? (
            <View style={styles.detail}>{request.detail(formatValue(current, request.step))}</View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const picked = vals[indexRef.current];
              request.onCommit(picked == null ? "" : formatValue(picked, request.step));
              onClose();
            }}
            style={[styles.done, { backgroundColor: request.accent }]}
          >
            <Text style={styles.doneText}>{copy.workout.done}</Text>
          </Pressable>
        </View>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "flex-end" },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    marginHorizontal: 12,
    backgroundColor: "#2f2a27",
    borderRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
    zIndex: 1,
  },
  top: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: {
    color: theme.orange.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  wheelWrap: { height: PAD * 2 + ITEM },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    top: PAD,
    height: ITEM,
    borderRadius: 10,
    backgroundColor: "rgba(233,182,155,0.18)",
  },
  detail: { alignItems: "center" },
  wheel: { height: PAD * 2 + ITEM },
  pad: { height: PAD },
  item: { height: ITEM, alignItems: "center", justifyContent: "center" },
  itemText: { color: theme.muted, fontFamily: theme.fonts.monoMedium, fontSize: 22 },
  itemOn: { color: "#ffffff" },
  unit: { color: theme.muted, fontFamily: theme.fonts.mono, fontSize: 13 },
  unitOn: { color: theme.orange.accent },
  valueBox: { justifyContent: "center" },
  valueText: { color: theme.text, fontFamily: theme.fonts.mono, fontSize: 16 },
  placeholder: { color: theme.muted },
  done: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  doneText: { color: "#ffffff", fontFamily: theme.fonts.bodySemi, fontSize: 15 },
});
