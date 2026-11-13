import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { copy, fill } from "@/copy";
import { engine } from "@/store";
import { theme } from "@/theme";
import { toDisplay } from "@/units";

type Exercise = { n: string; w?: number; r?: number; cardio?: number | boolean; min?: number };
type ReviewItem = { n: string; tag?: string };

export type ShareCardData = {
  title: string;
  date: string;
  minutes: string;
  sets: string;
  ups: number;
  rows: { name: string; value: string; up: boolean; cardio: boolean }[];
  more: number;
};

function setLine(row: Exercise) {
  if (row.cardio) return row.min ? fill(copy.workout.minutes, row.min) : copy.workout.done;
  if (engine.isBW(row.n)) {
    const left = row.w && row.w > 0 ? fill(copy.workout.bwPlusShort, toDisplay(row.w)) : "BW";
    return `${left} × ${row.r}`;
  }
  return `${toDisplay(row.w || 0)} × ${row.r}`;
}

export function readShareCard(id: string): ShareCardData | null {
  const day = (engine.DAYS as { id: string; title: string }[]).find((item) => item.id === id);
  if (!day) return null;
  const from = engine.wk.weekStart || 0;
  const session = ((engine.wk.sessions || []) as { k?: string; id?: string; t: number; min?: number; ex?: Exercise[] }[])
    .filter((item) => item.k === "lift" && item.id === id && item.t >= from)
    .pop();
  const timer = (engine.wk.wt || {})[id];
  const minutes =
    timer?.start && timer?.end
      ? Math.max(1, Math.round((timer.end - timer.start) / 60000))
      : session?.min || 0;
  const logged = session?.ex?.length ? session.ex : ((engine.daySummary(id) || []) as Exercise[]);
  const review = ((engine.wk.review || {})[id]?.items || []) as ReviewItem[];
  const setsFromLog = ((engine.DAYS as { id: string; slots: unknown[] }[]).find((item) => item.id === id)?.slots || []).reduce(
    (count: number, _slot, index) => {
      const log = (engine.get(id, index).log || []) as { d?: boolean }[];
      return count + log.filter((row) => row.d).length;
    },
    0,
  );
  const shown = logged.slice(0, 9);
  return {
    title: day.title.toUpperCase(),
    date: new Date(session ? session.t : Date.now()).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    minutes: minutes ? String(minutes) : "–",
    sets: String(setsFromLog || logged.filter((row) => !row.cardio).length),
    ups: review.filter((item) => item.tag === "up").length,
    rows: shown.map((row) => {
      const match = review.find((item) => item.n === row.n);
      return { name: row.n, value: setLine(row), up: match?.tag === "up", cardio: !!row.cardio };
    }),
    more: Math.max(0, logged.length - shown.length),
  };
}

export function ShareCardView({ data }: { data: ShareCardData }) {
  return (
    <LinearGradient colors={["#1e3a32", "#131615", "#131615"]} locations={[0, 0.45, 1]} style={styles.card}>
      <View style={styles.brandRow}>
        <Text style={styles.brand}>{copy.workout.liftBoard}</Text>
        <Text style={styles.date}>{data.date}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {data.title}
      </Text>
      <View style={styles.tiles}>
        {[
          [data.minutes, copy.workout.shareMin],
          [data.sets, copy.workout.shareSets],
          [String(data.ups), copy.workout.shareGoingUp],
        ].map(([value, label], index) => (
          <View key={label} style={styles.tile}>
            <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
            <Text style={[styles.tileValue, index === 2 && data.ups > 0 ? styles.up : null]}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.topLabel}>{copy.workout.shareTopSets}</Text>
      {data.rows.map((row) => (
        <View key={row.name} style={styles.exercise}>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={[styles.exerciseValue, row.up ? styles.up : null]}>
            {row.value}
            {row.up ? " ↑" : ""}
          </Text>
        </View>
      ))}
      {data.more ? <Text style={styles.more}>{fill(copy.workout.shareMore, data.more)}</Text> : null}
    </LinearGradient>
  );
}

export function ShareWorkoutButton({
  id,
  label,
  wide,
}: {
  id: string;
  label: string;
  wide?: boolean;
}) {
  const ref = useRef<any>(null);
  const [busy, setBusy] = useState(false);
  const data = readShareCard(id);

  async function share() {
    if (!ref.current || busy || !data) return;
    setBusy(true);
    try {
      const uri = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
      }
    } catch {
      // The sheet stays closed if capture or sharing is unavailable.
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  return (
    <>
      <View ref={ref} collapsable={false} style={styles.offscreen}>
        <ShareCardView data={data} />
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void share()}
        style={[styles.button, wide ? styles.wide : null, busy ? styles.busy : null]}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: "absolute", left: -4000, top: 0 },
  card: { width: 1080, minHeight: 1350, padding: 72, paddingBottom: 80 },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { color: theme.green.accent, fontFamily: theme.fonts.display, fontSize: 44 },
  date: { color: theme.muted, fontFamily: theme.fonts.bodyMedium, fontSize: 30 },
  title: {
    color: theme.text,
    fontFamily: theme.fonts.display,
    fontSize: 104,
    lineHeight: 108,
    marginTop: 48,
    textTransform: "uppercase",
  },
  tiles: { flexDirection: "row", gap: 24, marginTop: 36 },
  tile: {
    flex: 1,
    height: 170,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 32,
    paddingTop: 28,
    gap: 8,
  },
  tileLabel: { color: theme.muted, fontFamily: theme.fonts.bodySemi, fontSize: 26, letterSpacing: 1 },
  tileValue: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 72 },
  up: { color: theme.fuel },
  topLabel: { color: theme.muted, fontFamily: theme.fonts.bodySemi, fontSize: 26, letterSpacing: 1, marginTop: 48 },
  exercise: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 24,
    borderTopWidth: 2,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingVertical: 28,
    marginTop: 8,
  },
  exerciseName: { flex: 1, color: theme.text, fontFamily: theme.fonts.bodyMedium, fontSize: 36 },
  exerciseValue: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 40 },
  more: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 30, marginTop: 16 },
  button: {
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
  },
  wide: { alignSelf: "stretch" },
  busy: { opacity: 0.5 },
  buttonText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 16 },
});
