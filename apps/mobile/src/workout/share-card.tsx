"use no memo";

import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/pressable-scale";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { startOfDay, useNotice } from "@/activity-log";
import { copy, fill } from "@/copy";
import { Download, Share } from "@/icons";
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
  prs: number;
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
    prs: prsOnDay(session ? session.t : Date.now()),
    rows: shown.map((row) => {
      const match = review.find((item) => item.n === row.n);
      return { name: row.n, value: setLine(row), up: match?.tag === "up", cardio: !!row.cardio };
    }),
    more: Math.max(0, logged.length - shown.length),
  };
}

function prsOnDay(when: number): number {
  const from = startOfDay(when).getTime();
  return (engine.recentPrs() as { t: number }[]).filter((row) => row.t >= from && row.t < from + 864e5).length;
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
        {(
          [
            { value: data.minutes, label: copy.workout.shareMin, hot: false },
            { value: data.sets, label: copy.workout.shareSets, hot: false },
            { value: String(data.prs), label: data.prs === 1 ? copy.workout.sharePr : copy.workout.sharePrs, hot: data.prs > 0 },
          ] as const
        ).map((tile) => (
          <View key={tile.label} style={styles.tile}>
            <Text style={styles.tileLabel}>{tile.label.toUpperCase()}</Text>
            <Text style={[styles.tileValue, tile.hot ? styles.up : null]}>{tile.value}</Text>
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

/** The default import asks for ExpoMediaLibraryNext, which Expo Go does not ship. Load the legacy module only when saving. */
async function saveToPhotos(uri: string) {
  const MediaLibrary = await import("expo-media-library/legacy");
  const current = await MediaLibrary.getPermissionsAsync(true);
  const access = current.granted ? current : current.canAskAgain ? await MediaLibrary.requestPermissionsAsync(true) : current;
  if (!access.granted) return false;
  await MediaLibrary.createAssetAsync(uri);
  return true;
}

export function ShareWorkoutActions({ id }: { id: string }) {
  const ref = useRef<any>(null);
  const [busy, setBusy] = useState(false);
  const data = readShareCard(id);

  async function capture() {
    if (!ref.current) return null;
    return captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
  }

  async function share() {
    if (busy || !data) return;
    setBusy(true);
    try {
      const uri = await capture();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
      }
    } catch {
      // The sheet stays closed if capture or sharing is unavailable.
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (busy || !data) return;
    setBusy(true);
    try {
      const uri = await capture();
      if (!uri || !(await saveToPhotos(uri))) return;
      useNotice.getState().show([copy.workout.savedToPhotos], { pulse: false, variant: "plain" });
    } catch {
      // Leave the card on screen when Photos can't be written.
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
      <View style={styles.actions}>
        <PressableScale
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void save()}
          style={[styles.button, styles.save, busy ? styles.busy : null]}
        >
          <Download size={16} color={theme.text} />
          <Text style={styles.buttonText}>{copy.workout.saveToPhotos}</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={copy.workout.share}
          disabled={busy}
          onPress={() => void share()}
          style={[styles.button, styles.iconButton, busy ? styles.busy : null]}
        >
          <Share size={16} color={theme.text} />
        </PressableScale>
      </View>
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
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
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
  save: { flex: 1 },
  iconButton: { width: 52, paddingHorizontal: 0 },
  busy: { opacity: 0.5 },
  buttonText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 16 },
});
