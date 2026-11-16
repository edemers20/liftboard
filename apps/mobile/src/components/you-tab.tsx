import { useEffect, useRef, useState } from "react";
import { PressableScale } from "@/components/pressable-scale";
import { File, Paths } from "expo-file-system";
import { usePathname, useRouter } from "expo-router";
import { AccessibilityInfo, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View, type AccessibilityRole } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { applyBackup, parseBackup, type LiftBackup } from "@/backup";
import { playChime } from "@/chime";
import { LiveWorkoutBar } from "@/components/live-workout";
import { SheetFrame } from "@/components/motion";
import { ageDial, bodyFatDial, DialValue, heightDial, stepsDial, weightDial, type DialSpec } from "@/components/number-dial";
import { copy, fill } from "@/copy";
import { haptic } from "@/haptic";
import { storage } from "@/storage";
import { resetTabTips } from "@/tab-tips";
import { TabScrollMarker } from "@/tab-bar-inset";
import { engine, useEngineStore } from "@/store";
import { rollWeekIfDue } from "@/week-roll";
import { theme } from "@/theme";
import { fromDisplay, toDisplay } from "@/units";
const SESSION_MINUTES = [30, 45, 60, 75] as const;
const LEVELS = ["new", "some", "years"] as const;
const SEX = ["Female", "Male", "Other"] as const;

type Draft = {
  acts?: Record<string, boolean>;
  mainSport?: string;
  sport2?: string;
  season?: string;
  focus?: string;
  sex?: string;
  name?: string;
  age?: string;
  height?: string;
  weight?: string;
  bf?: string;
  steps?: string;
  oura?: string;
  level?: string;
  time?: number;
  ss?: string;
  stretch?: string;
  sound?: string;
};

type Source = {
  acts: Record<string, boolean>;
  mainSport: string;
  sport2: string;
  season: string;
  focus: string;
  sex: string;
  days: string;
  name: string;
  age: string;
  height: string;
  weight: string;
  bf: string;
  steps: string;
  oura: string;
  level: string;
  time: number;
  ss: string;
  stretch: string;
  sound: string;
};

type Tile = {
  label: string;
  value: string;
  unit?: string;
  text?: boolean;
  wide?: boolean;
};

function str(value: unknown) {
  return value == null ? "" : String(value);
}

function lookup(table: object, key: unknown) {
  if (typeof key !== "string") return undefined;
  return (table as Record<string, string>)[key];
}

function activityName(id: string) {
  if (id === "zone2") return copy.activities.zone2;
  return lookup(copy.activityNames, id) ?? id;
}

function levelKey(week: { level?: string; guide?: string }) {
  if (week.level === "new" || week.level === "some" || week.level === "years") return week.level;
  return week.guide === "Less" ? "years" : "some";
}

function memberSince(week: { createdAt?: number; weekStart?: number; sessions?: { t: number }[] }) {
  const times = [week.createdAt, ...(week.sessions || []).map((session) => session.t), week.weekStart].filter(
    (time): time is number => typeof time === "number" && Number.isFinite(time) && time > 0,
  );
  if (!times.length) return copy.you.thisWeek;
  return new Date(Math.min(...times)).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function mix(from: string, to: string, t: number) {
  const parts = (hex: string) => [0, 2, 4].map((index) => parseInt(hex.slice(index + 1, index + 3), 16));
  const start = parts(from);
  const end = parts(to);
  const mixed = start.map((channel, index) => Math.round(channel + (end[index] - channel) * t));
  return `rgb(${mixed.join(",")})`;
}

function weightShown(stored: string, kgMode: boolean) {
  if (!kgMode || stored.trim() === "" || Number.isNaN(Number(stored))) return stored;
  return String(toDisplay(Number(stored)));
}

function weightStored(shown: string, kgMode: boolean) {
  if (!kgMode) return shown;
  return fromDisplay(shown);
}

function sourceFrom(draft: Draft | null): Source {
  const week = engine.wk;
  return {
    acts: { ...(week.acts || {}), ...(draft?.acts || {}) },
    mainSport: draft?.mainSport ?? week.mainSport ?? "",
    sport2: draft?.sport2 ?? week.sport2 ?? "",
    season: draft?.season ?? week.season ?? "",
    focus: draft?.focus ?? week.focus ?? "",
    sex: draft?.sex ?? week.sex ?? "",
    days: str(week.days),
    name: draft?.name ?? str(week.name),
    age: draft?.age ?? str(week.age),
    height: draft?.height ?? str(week.height),
    weight: draft?.weight ?? str(week.weight),
    bf: draft?.bf ?? str(week.bf),
    steps: draft?.steps ?? str(week.steps),
    oura: draft?.oura ?? str(week.oura),
    level: draft?.level ?? levelKey(week),
    time: draft?.time ?? (Number(week.time) || 60),
    ss: draft?.ss ?? (week.ss || "Yes"),
    stretch: draft?.stretch ?? (week.stretch || "No"),
    sound: draft?.sound ?? (week.sound || "Yes"),
  };
}

function matchesSaved(key: keyof Draft, value: unknown) {
  const week = engine.wk;
  if (key === "ss" || key === "sound") return value === (week[key] || "Yes");
  if (key === "stretch") return value === (week.stretch || "No");
  if (key === "level") return value === levelKey(week);
  if (key === "time") return Number(value) === (Number(week.time) || 60);
  return JSON.stringify(value) === JSON.stringify(week[key]);
}

function dirty(draft: Draft | null) {
  if (!draft) return false;
  return (Object.keys(draft) as (keyof Draft)[]).some(
    (key) => JSON.stringify(draft[key]) !== JSON.stringify(engine.wk[key]),
  );
}

function profileTiles(kgMode: boolean, summaryOnly = false): Tile[] {
  const week = engine.wk;
  const tiles: Tile[] = [];
  const goal = lookup(copy.goals, week.mode);
  if (goal) tiles.push({ label: copy.you.goal, value: goal, text: true, wide: true });
  const level = lookup(copy.levels, levelKey(week));
  if (level) tiles.push({ label: copy.you.experience, value: level, text: true, wide: true });
  if (engine.enabled("lift")) {
    const focus = lookup(copy.focus, week.focus);
    if (focus) tiles.push({ label: copy.you.liftingFocus, value: focus, text: true, wide: true });
    if (engine.DAYS.length) {
      tiles.push({ label: copy.you.liftDays, value: String(engine.DAYS.length), unit: copy.you.perWeek, wide: true });
    }
  }
  if (summaryOnly) return tiles;
  const height = engine.num(week.height, 0);
  if (height) {
    if (kgMode) {
      tiles.push({ label: copy.you.height, value: String(Math.round(height * 2.54)), unit: copy.you.cm });
    } else {
      tiles.push({
        label: copy.you.height,
        value: `${Math.floor(height / 12)}′${Math.round(height % 12)}″`,
      });
    }
  }
  const weight = engine.num(week.weight, 0);
  if (weight) {
    tiles.push(
      kgMode
        ? { label: copy.you.weight, value: String(toDisplay(weight)), unit: copy.you.kg }
        : { label: copy.you.weight, value: String(weight), unit: copy.you.lb },
    );
  }
  if (week.bf) tiles.push({ label: copy.you.bodyFat, value: String(week.bf), unit: "%" });
  const steps = engine.num(week.steps, 0);
  if (steps) {
    tiles.push({
      label: copy.you.stepsPerDay,
      value: (steps / 1000).toFixed(steps % 1000 ? 1 : 0),
      unit: copy.you.k,
    });
  }
  if (week.age) tiles.push({ label: copy.you.age, value: String(week.age) });
  const sex = lookup(copy.sex, week.sex);
  if (sex) tiles.push({ label: copy.you.sex, value: sex, text: true });
  return tiles;
}

type WebLink = { href: string; download: string; click(): void };

/** Same three-key file the web backup writes, so a later import can read it. */
async function shareBackup(): Promise<boolean> {
  const json = JSON.stringify({
    app: "liftboard",
    v: 1,
    at: new Date().toISOString(),
    keys: {
      [engine.KEY]: storage.getItem(engine.KEY),
      [engine.KEY2]: storage.getItem(engine.KEY2),
      [engine.KEY3]: storage.getItem(engine.KEY3),
    },
  });
  const name = fill(copy.you.backupFile, new Date().toISOString().slice(0, 10));
  if (Platform.OS === "web") {
    const doc = (globalThis as { document?: { createElement(tag: string): WebLink } }).document;
    if (!doc) return false;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = doc.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(json);
  const result = await Share.share(Platform.OS === "ios" ? { url: file.uri } : { message: json, title: name });
  return result.action === Share.sharedAction;
}

type WebInput = {
  type: string;
  accept: string;
  style: { display: string };
  files?: { 0?: { text(): Promise<string> } } | null;
  click(): void;
  remove(): void;
  onchange: (() => void) | null;
};

type WebDoc = {
  body: { appendChild(node: WebInput): void };
  createElement(tag: string): WebInput;
};

/** Read a backup the person picked. Web uses a file input; the phone uses the system picker. */
function readBackupFile(): Promise<string | null> {
  if (Platform.OS === "web") {
    const doc = (globalThis as { document?: WebDoc }).document;
    if (!doc) return Promise.resolve(null);
    return new Promise((resolve) => {
      const input = doc.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.style = { display: "none" };
      input.onchange = () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) {
          resolve(null);
          return;
        }
        void file.text().then(resolve, () => resolve(null));
      };
      doc.body.appendChild(input);
      input.click();
    });
  }
  return File.pickFileAsync({ mimeTypes: "*/*" }).then(async (picked) => {
    if (picked.canceled || !picked.result) return null;
    return picked.result.text();
  });
}

/** Settings, opened from the gear on You. Body edits stay in a draft until saved. */
export function SettingsScreen({ onReplay, startMetrics = false }: { onReplay: () => void; startMetrics?: boolean }) {
  "use no memo";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useEngineStore((state) => state.version);
  const call = useEngineStore((state) => state.call);
  const [editing, setEditing] = useState(startMetrics);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openFaq, setOpenFaq] = useState<Record<number, boolean>>({});
  const [confirm, setConfirm] = useState<null | "reset" | "delete" | "restore">(null);
  const [pending, setPending] = useState<LiftBackup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const path = usePathname();
  const kgMode = engine.wk.units === "kg";
  const changed = dirty(draft);
  const form = sourceFrom(draft);

  function stage(partial: Draft) {
    setDraft((prev) => {
      const next: Draft = { ...(prev ?? {}), ...partial };
      if (partial.acts) {
        const fixed = {
          acts: partial.acts,
          mainSport: next.mainSport ?? engine.wk.mainSport ?? "",
          sport2: next.sport2 ?? engine.wk.sport2 ?? "",
          season: next.season ?? engine.wk.season ?? "",
        };
        engine.fixSports(fixed);
        next.acts = fixed.acts;
        next.mainSport = fixed.mainSport;
        next.sport2 = fixed.sport2;
        next.season = fixed.season;
      }
      (Object.keys(next) as (keyof Draft)[]).forEach((key) => {
        if (matchesSaved(key, next[key])) delete next[key];
      });
      return Object.keys(next).length ? next : null;
    });
  }

  function write(key: string, value: string | number) {
    call((api) => {
      api.wk[key] = value;
      if (key === "level") api.wk.guide = value === "years" ? "Less" : "More";
      api.save();
    });
  }

  function saveProfile() {
    if (!draft || !dirty(draft)) return;
    const next = draft;
    call((api) => {
      Object.assign(api.wk, next);
      if (next.level) api.wk.guide = next.level === "years" ? "Less" : "More";
      api.fixSports(api.wk);
      api.syncDays();
      api.save();
    });
    setDraft(null);
    setEditing(false);
    AccessibilityInfo.announceForAccessibility(copy.you.profileSaved);
  }

  function closeEdit() {
    if (dirty(draft)) return;
    setDraft(null);
    setEditing(false);
  }

  function saveSport(id: string) {
    call((api) => {
      const mains = new Set([...(api.SPORTS as string[]), "yoga", "pilates"]);
      let main = api.wk.mainSport || "";
      let second = api.wk.sport2 || "";
      if (!id) {
        main = "";
        second = "";
      } else if (mains.has(id)) {
        if (id === second) {
          second = main;
          main = id;
        } else if (id !== main) {
          if (!main) main = id;
          else second = id;
        }
        api.wk.acts = { ...(api.wk.acts || {}), [id]: true };
        if (api.wk[id] == null || api.wk[id] === "") api.wk[id] = 0;
      }
      api.wk.mainSport = main;
      api.wk.sport2 = second;
      api.fixSports(api.wk);
      api.syncDays();
      api.save();
    });
  }

  function eraseOnThisPhone() {
    setConfirm(null);
    setDraft(null);
    setEditing(false);
    call((api) => {
      storage.setItem(api.KEY, "{}");
      storage.setItem(api.KEY2, "");
      storage.setItem(api.KEY3, "{}");
      api.init(storage);
      api.save();
    });
  }

  async function exportData() {
    try {
      const shared = await shareBackup();
      if (shared) AccessibilityInfo.announceForAccessibility(copy.you.backupDownloaded);
    } catch {
      // The share sheet can close without handing the file off. The backup itself is not logged.
    }
  }

  async function chooseBackup() {
    setNotice(null);
    let text: string | null = null;
    try {
      text = await readBackupFile();
    } catch {
      text = null;
    }
    if (text == null) return;
    const backup = parseBackup(text);
    if (!backup) {
      setNotice(copy.you.notBackup);
      AccessibilityInfo.announceForAccessibility(copy.you.notBackup);
      return;
    }
    setPending(backup);
    setConfirm("restore");
  }

  function restoreFromBackup() {
    const backup = pending;
    if (!backup) {
      setConfirm(null);
      setPending(null);
      return;
    }
    call((api) => {
      applyBackup(backup, storage, api);
      rollWeekIfDue();
    });
    setDraft(null);
    setEditing(false);
    setConfirm(null);
    setPending(null);
    useEngineStore.setState((state) => ({ version: state.version + 1 }));
  }

  const week = engine.wk;
  const [adding, setAdding] = useState(false);
  const [showAllFaq, setShowAllFaq] = useState(false);
  const mainActs = ([...(engine.SPORTS as string[]), "yoga", "pilates"] as string[]).filter(
    (id, index, all) => all.indexOf(id) === index,
  );
  const otherChoices = (engine.ACT_IDS as string[]).filter((id) => id !== "lift" && !mainActs.includes(id));
  const shownOthers = adding ? otherChoices : otherChoices.filter((id) => engine.enabled(id));
  const mainNow = String(week.mainSport || "");
  const secondNow = String(week.sport2 || "");
  const planFaq = copy.faq.findIndex(([question]) => question.startsWith("How is my plan"));
  const fuelFaq = copy.faq.findIndex(([question]) => question.startsWith("How is fuel"));

  function toggleActivity(id: string) {
    call((api) => {
      const on = !api.wk.acts?.[id];
      api.wk.acts = { ...(api.wk.acts || {}), [id]: on };
      if (on && (api.SPORTS as string[]).includes(id)) {
        if (!api.wk.mainSport) api.wk.mainSport = id;
        else if (!api.wk.sport2 && api.wk.mainSport !== id) api.wk.sport2 = id;
      }
      api.fixSports(api.wk);
      api.syncDays();
      api.save();
    });
  }

  function metric(label: string, value: string) {
    return (
      <View key={label} style={styles.metric}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value || copy.you.emptyMetric}</Text>
      </View>
    );
  }

  const heightIn = engine.num(week.height, 0);
  const heightText = heightIn
    ? kgMode
      ? `${Math.round(heightIn * 2.54)} ${copy.you.cm}`
      : `${Math.floor(heightIn / 12)}′${Math.round(heightIn % 12)}″`
    : "";
  const weightN = engine.num(week.weight, 0);
  const weightText = weightN ? `${kgMode ? toDisplay(weightN) : weightN} ${kgMode ? copy.you.kg : copy.you.lb}` : "";
  const stepsN = engine.num(week.steps, 0);
  const levelLabel = lookup(copy.levels, levelKey(week)) || "";

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TabScrollMarker>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: Math.max(28, insets.bottom + 16) }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        scrollsToTop
        contentInsetAdjustmentBehavior="never"
      >
        <PressableScale accessibilityRole="button" accessibilityLabel={copy.you.backYou} onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backText}>{copy.you.backYou}</Text>
        </PressableScale>
        <Text accessibilityRole="header" style={styles.settingsTitle}>{copy.you.settings}</Text>
        <PressableScale accessibilityRole="button" onPress={() => router.push("/plan")} style={styles.seasonNote}>
          <Text style={styles.seasonNoteText}>
            {copy.you.seasonNote}
            <Text style={styles.seasonNoteLink}>{copy.you.planSeason}</Text>.
          </Text>
        </PressableScale>

        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.eyebrow}>{copy.you.body}</Text>
          {editing ? (
            <BodyForm
              form={form}
              kgMode={kgMode}
              onStage={stage}
            />
          ) : (
            <View style={styles.metrics}>
              {metric(copy.you.height, heightText)}
              {metric(copy.you.weight, weightText)}
              {metric(copy.you.bodyFat, week.bf ? `${week.bf}%` : "")}
              {metric(copy.you.age, str(week.age))}
              {metric(copy.you.sex, lookup(copy.sex, week.sex) || "")}
              {metric(copy.you.stepsADay, stepsN ? stepsN.toLocaleString("en-US") : "")}
            </View>
          )}
          <PressableScale
            kind="text"
            accessibilityRole="button"
            onPress={() => {
              if (editing && changed) saveProfile();
              else if (editing) closeEdit();
              else setEditing(true);
            }}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>{copy.you.editMetrics}</Text>
          </PressableScale>
        </View>

        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.eyebrow}>{copy.you.training}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.rowLabel}>{copy.you.experience}</Text>
            <Text style={styles.rowHint}>{levelLabel}</Text>
          </View>
          <ExperienceSlider value={levelKey(week)} onChange={(level) => write("level", level)} />
          <Toggle label={copy.you.supersets} on={(week.ss || "Yes") === "Yes"} onPress={() => write("ss", (week.ss || "Yes") === "Yes" ? "No" : "Yes")} />
          <Toggle label={copy.you.stretchingAfterLifts} on={week.stretch === "Yes"} onPress={() => write("stretch", week.stretch === "Yes" ? "No" : "Yes")} />
          <View style={styles.soundRow}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowLabel}>{copy.you.restTimerSound}</Text>
              <TestSoundButton />
            </View>
            <Toggle
              bare
              label={copy.you.restTimerSound}
              on={(week.sound || "Yes") === "Yes"}
              onPress={() => write("sound", (week.sound || "Yes") === "Yes" ? "No" : "Yes")}
            />
          </View>
        </View>

        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.eyebrow}>{copy.you.activities}</Text>
          <Text style={styles.sportsLabel}>
            <Text style={styles.fieldTitle}>{copy.you.sportsInSeason}</Text>
            <Text style={styles.rowHint}>{copy.you.sportsHint}</Text>
          </Text>
          <View style={styles.pills}>
            <Pill label={copy.you.none} selected={!mainNow} tone="pink" onPress={() => saveSport("")} />
            {mainActs.map((id) => {
              const picked = mainNow === id || secondNow === id;
              const primary = mainNow === id && !!secondNow;
              return (
                <Pill
                  key={id}
                  label={activityName(id)}
                  badge={primary ? copy.you.primary : undefined}
                  selected={picked}
                  tone="pink"
                  onPress={() => saveSport(id)}
                />
              );
            })}
            {shownOthers.map((id) => (
              <Pill
                key={id}
                label={activityName(id)}
                selected={engine.enabled(id)}
                tone="pink"
                onPress={() => toggleActivity(id)}
              />
            ))}
            <PressableScale
              accessibilityRole="button"
              accessibilityState={{ expanded: adding }}
              onPress={() => setAdding((open) => !open)}
              style={[styles.actPill, styles.actPillOff]}
            >
              <Text style={styles.actPillTextOff}>{copy.you.addActivity}</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.eyebrow}>
            {copy.you.app}
          </Text>
          <TwoWay
            label={copy.you.units}
            value={kgMode ? "kg" : "lb"}
            options={[
              ["lb", copy.you.lb],
              ["kg", copy.you.kg],
            ]}
            onChange={(value) => write("units", value)}
          />
          <TwoWay
            label={copy.you.tips}
            value={week.guide === "Less" ? "Less" : "More"}
            options={[
              ["More", copy.you.more],
              ["Less", copy.you.fewer],
            ]}
            onChange={(value) => write("guide", value)}
          />
          <TwoWay
            label={copy.you.weekStartsOn}
            value={week.wkStart === "Sun" ? "Sun" : "Mon"}
            options={[
              ["Mon", copy.you.mon],
              ["Sun", copy.you.sun],
            ]}
            onChange={(value) => call((api) => api.setWeekStart(value))}
          />
          <Toggle
            label={copy.you.nextMorning}
            on={(week.remind || "On") !== "Off"}
            onPress={() => write("remind", (week.remind || "On") === "Off" ? "On" : "Off")}
          />
        </View>

        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.eyebrow}>
            {copy.you.help}
          </Text>
          <View>
            {[
              { index: planFaq, label: copy.faq[planFaq]?.[0] || "" },
              { index: fuelFaq, label: copy.you.howFuelWorkedOut },
            ].map(({ index, label }, row) => {
              const open = !!openFaq[index];
              const answer = copy.faq[index]?.[1] || "";
              return (
                <PressableScale
                  key={label}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setOpenFaq((prev) => ({ ...prev, [index]: !prev[index] }))}
                  style={[styles.helpRow, row === 0 ? null : styles.faqDivider]}
                >
                  <View style={styles.helpLine}>
                    <Text style={styles.rowLabel}>{label}</Text>
                    <Text style={styles.helpChevron}>›</Text>
                  </View>
                  {open ? <Text style={styles.faqAnswer}>{answer}</Text> : null}
                </PressableScale>
              );
            })}
            <PressableScale
              accessibilityRole="button"
              accessibilityState={{ expanded: showAllFaq }}
              onPress={() => setShowAllFaq((open) => !open)}
              style={[styles.helpRow, styles.faqDivider]}
            >
              <View style={styles.helpLine}>
                <Text style={styles.rowLabel}>{copy.you.allQuestions}</Text>
                <Text style={styles.helpChevron}>›</Text>
              </View>
            </PressableScale>
            {showAllFaq
              ? copy.faq.map(([question, answer], index) =>
                  index === planFaq || index === fuelFaq ? null : (
                    <View key={question} style={[styles.faqItem, styles.faqDivider]}>
                      <Text style={styles.faqQuestionText}>{question}</Text>
                      <Text style={styles.faqAnswer}>{answer}</Text>
                    </View>
                  ),
                )
              : null}
          </View>
        </View>

        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.eyebrow}>
            {copy.you.yourData}
          </Text>
          <PressableScale accessibilityRole="button" onPress={() => void exportData()} style={[styles.helpRow, styles.faqDivider]}>
            <View style={styles.helpLine}>
              <Text style={styles.rowLabel}>{copy.you.exportData}</Text>
              <Text style={styles.helpChevron}>›</Text>
            </View>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            onPress={() => {
              resetTabTips(path);
              onReplay();
            }}
            style={[styles.helpRow, styles.faqDivider]}
          >
            <View style={styles.helpLine}>
              <Text style={styles.rowLabel}>{copy.you.replayTour}</Text>
              <Text style={styles.helpChevron}>›</Text>
            </View>
          </PressableScale>
          {__DEV__ ? (
            <PressableScale accessibilityRole="button" onPress={() => void chooseBackup()} style={[styles.helpRow, styles.faqDivider]}>
              <View style={styles.helpLine}>
                <Text style={styles.rowLabel}>{copy.you.restoreBackup}</Text>
                <Text style={styles.helpChevron}>›</Text>
              </View>
            </PressableScale>
          ) : null}
          {notice ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
          <PressableScale accessibilityRole="button" onPress={() => setConfirm("reset")} style={[styles.helpRow, styles.faqDivider]}>
            <Text style={styles.dangerLabel}>{copy.you.resetProfile}</Text>
          </PressableScale>
          <PressableScale accessibilityRole="button" onPress={() => setConfirm("delete")} style={[styles.helpRow, styles.faqDivider]}>
            <Text style={styles.dangerLabel}>{copy.you.deleteAccount}</Text>
          </PressableScale>
        </View>
      </ScrollView>
      </TabScrollMarker>

      {editing ? (
        <View style={[styles.saveBar, { paddingBottom: Math.max(12, insets.bottom) }]}>
          <PressableScale
            accessibilityRole="button"
            onPress={() => (changed ? saveProfile() : closeEdit())}
            style={[styles.save, changed ? styles.saveOn : styles.secondary]}
          >
            <Text style={[styles.saveText, changed ? styles.saveTextOn : styles.secondaryText]}>
              {changed ? copy.you.saveClose : copy.you.close}
            </Text>
          </PressableScale>
        </View>
      ) : null}
      </KeyboardAvoidingView>

      <SheetFrame
        visible={confirm != null}
        label={copy.you.cancel}
        onClose={() => {
          setConfirm(null);
          setPending(null);
        }}
      >
          <View style={styles.sheet}>
            <Text accessibilityRole="header" style={styles.confirmTitle}>
              {confirm === "restore"
                ? copy.you.restoreTitle
                : confirm === "delete"
                  ? copy.you.deleteAccount
                  : copy.you.resetProfile}
            </Text>
            <Text style={styles.confirmBody}>
              {confirm === "restore"
                ? fill(copy.you.restoreBody, new Date(pending?.at || "").toLocaleDateString())
                : copy.you.resetBody}
            </Text>
            <View style={styles.confirmButtons}>
              <PressableScale
                accessibilityRole="button"
                onPress={() => {
                  setConfirm(null);
                  setPending(null);
                }}
                style={[styles.secondary, styles.confirmCancel]}
              >
                <Text style={styles.secondaryText}>{copy.you.cancel}</Text>
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                onPress={() => {
                  if (confirm !== "restore") haptic.warning();
                  if (confirm === "restore") restoreFromBackup();
                  else eraseOnThisPhone();
                }}
                style={confirm === "restore" ? styles.restore : styles.danger}
              >
                <Text style={styles.dangerText}>
                  {confirm === "restore" ? copy.you.restore : copy.you.erase}
                </Text>
              </PressableScale>
            </View>
          </View>
      </SheetFrame>
      <LiveWorkoutBar />
    </View>
  );
}

function Avatar({ letter }: { letter: string }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.avatar}>
      <View style={styles.avatarGradient}>
        {Array.from({ length: 14 }, (_, index) => (
          <View
            key={index}
            style={{ flex: 1, backgroundColor: mix("#6fd0b4", "#e9b69b", index / 13) }}
          />
        ))}
      </View>
      <Text style={styles.avatarLetter}>{letter}</Text>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View accessible style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ExperienceSlider({ value, onChange }: { value: string; onChange: (level: string) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={copy.you.experience} style={styles.slider}>
      <View pointerEvents="none" style={styles.track}>
        {Array.from({ length: 12 }, (_, index) => (
          <View key={index} style={{ flex: 1, backgroundColor: mix("#6fd0b4", theme.pink.accent, index / 11) }} />
        ))}
      </View>
      <View style={styles.stops}>
        {LEVELS.map((level) => {
          const selected = level === value;
          const label = lookup(copy.levels, level) ?? level;
          return (
            <PressableScale
              key={level}
              accessibilityRole={"radio" as AccessibilityRole}
              accessibilityState={{ selected }}
              accessibilityLabel={label}
              onPress={() => {
                if (level !== value) haptic.selection();
                onChange(level);
              }}
              style={styles.stop}
            >
              <View style={styles.knobHit}>
                <View style={[styles.knob, selected && styles.knobOn]} />
              </View>
              <Text style={[styles.stopLabel, selected && styles.stopLabelOn]}>{label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function Toggle({ label, on, onPress, bare }: { label: string; on: boolean; onPress: () => void; bare?: boolean }) {
  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      aria-checked={on}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={bare ? styles.switchOnly : styles.row}
    >
      {bare ? null : <Text style={styles.rowLabel}>{label}</Text>}
      <View pointerEvents="none" style={[styles.switchTrack, on && styles.switchTrackOn]}>
        <View style={[styles.switchKnob, on && styles.switchKnobOn]} />
      </View>
    </PressableScale>
  );
}

function TwoWay({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.trackSwitch}>
        {options.map(([option, text]) => {
          const selected = option === value;
          return (
            <PressableScale
              key={option}
              accessibilityRole={"radio" as AccessibilityRole}
              accessibilityState={{ selected }}
              accessibilityLabel={text}
              onPress={() => {
                if (option !== value) haptic.selection();
                onChange(option);
              }}
              style={[styles.segment, selected && styles.segmentOn]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>{text}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function TestSoundButton() {
  const [playing, setPlaying] = useState(false);
  const round = useRef(0);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ busy: playing }}
      onPress={() => {
        const mine = ++round.current;
        setPlaying(true);
        playChime(() => {
          if (round.current === mine) setPlaying(false);
        });
      }}
      style={styles.testSound}
    >
      <Text style={styles.testLinkText}>{playing ? copy.you.playing : copy.you.playTestSound}</Text>
    </PressableScale>
  );
}

function BodyForm({ form, kgMode, onStage }: { form: Source; kgMode: boolean; onStage: (partial: Draft) => void }) {
  return (
      <View style={styles.form}>
        <Text style={styles.fieldTitle}>{copy.you.sex}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={copy.you.sex} style={styles.pills}>
          {SEX.map((id) => (
            <Pill
              key={id}
              label={lookup(copy.sex, id) ?? id}
              selected={form.sex === id}
              tone="pink"
              onPress={() => onStage({ sex: id })}
            />
          ))}
        </View>
        <View style={styles.fields}>
          <Field label={copy.you.age} value={form.age} dial={ageDial} onChange={(age) => onStage({ age })} />
          <Field label={copy.you.heightIn} value={form.height} dial={heightDial} onChange={(height) => onStage({ height })} />
          <Field
            label={kgMode ? copy.you.weightLb.replaceAll("lb", copy.you.kg) : copy.you.weightLb}
            value={weightShown(form.weight, kgMode)}
            dial={weightDial(kgMode)}
            onChange={(text) => onStage({ weight: weightStored(text, kgMode) })}
          />
          <Field
            label={copy.you.bodyFatPct}
            value={form.bf}
            placeholder={copy.onboarding.optional}
            dial={bodyFatDial}
            onChange={(bf) => onStage({ bf })}
          />
          <Field
            label={copy.you.stepsADay}
            value={form.steps}
            dial={stepsDial}
            start={form.steps.trim() ? undefined : Number(copy.onboarding.stepsExample.replace(/[^\d]/g, "")) || undefined}
            onChange={(steps) => onStage({ steps })}
          />
        </View>
      </View>
  );
}

function Pill({
  label,
  badge,
  selected,
  tone,
  onPress,
}: {
  label: string;
  badge?: string;
  selected: boolean;
  tone: "pink" | "green";
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      brighten={selected}
      style={[styles.pill, selected && (tone === "pink" ? styles.pillPink : styles.pillGreen)]}
    >
      <Text style={[styles.pillText, selected && (tone === "pink" ? styles.pillTextPink : styles.pillTextGreen)]}>
        {label}
        {badge ? <Text style={styles.badge}> {badge}</Text> : null}
      </Text>
    </PressableScale>
  );
}

function Field({
  label,
  value,
  placeholder,
  dial,
  start,
  keyboard,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  dial?: DialSpec;
  start?: number;
  keyboard?: "number-pad" | "decimal-pad";
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {dial ? (
        <DialValue label={label} value={value} placeholder={placeholder} spec={dial} start={start} onChange={onChange} style={styles.input} textStyle={styles.inputMono} />
      ) : (
        <TextInput
          accessibilityLabel={label}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={theme.muted}
          onChangeText={onChange}
          keyboardType={keyboard}
          inputMode={keyboard === "decimal-pad" ? "decimal" : keyboard === "number-pad" ? "numeric" : "text"}
          style={[styles.input, keyboard ? styles.inputMono : null]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.pink.background },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 12 },
  backLink: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  backText: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.muted },
  settingsTitle: {
    fontFamily: theme.fonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: theme.text,
    textTransform: "uppercase",
  },
  seasonNote: { backgroundColor: "#2a2329", borderRadius: 14, padding: 12 },
  seasonNoteText: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: "#d9c9cf" },
  seasonNoteLink: { fontFamily: theme.fonts.bodySemi, color: theme.pink.accent },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingVertical: 10 },
  metric: { width: "30%", flexGrow: 1, gap: 2 },
  metricLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  metricValue: { fontFamily: theme.fonts.mono, fontSize: 18, color: theme.text },
  valueRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.pink.line,
    paddingVertical: 12,
  },
  soundRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.pink.line,
  },
  actPill: { minHeight: 44, paddingHorizontal: 12, borderRadius: theme.radii.pill, alignItems: "center", justifyContent: "center" },
  actPillOff: { backgroundColor: theme.pink.background },
  actPillTextOff: { color: theme.muted },
  helpRow: { paddingVertical: 12, gap: 4 },
  helpLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  helpChevron: { fontFamily: theme.fonts.body, fontSize: 18, color: theme.muted },
  dangerLabel: { fontFamily: theme.fonts.body, fontSize: 15, color: "#ff8a80" },
  switchOnly: { width: 52, height: 44, alignItems: "center", justifyContent: "center" },
  testLinkText: { fontFamily: theme.fonts.bodySemi, fontSize: 12, color: theme.pink.accent },
  hero: { gap: 12, paddingBottom: 4 },
  who: { flexDirection: "row", alignItems: "center", gap: 14 },
  whoText: { flex: 1 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarGradient: {
    position: "absolute",
    width: 96,
    height: 96,
    left: -16,
    top: -16,
    transform: [{ rotate: "-45deg" }],
  },
  avatarLetter: { fontFamily: theme.fonts.display, fontSize: 30, color: "#181513" },
  name: {
    fontFamily: theme.fonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: theme.text,
    textTransform: "uppercase",
  },
  since: { marginTop: 4, fontFamily: theme.fonts.body, fontSize: 13, color: theme.muted },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "#2a1f25", borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { fontFamily: theme.fonts.bodySemi, fontSize: 12, color: theme.pink.accent },
  stats: { flexDirection: "row", gap: 6 },
  stat: { flex: 1, backgroundColor: theme.pink.surface, borderRadius: 14, padding: 12 },
  statValue: { fontFamily: theme.fonts.monoMedium, fontSize: 22, color: theme.text },
  statLabel: {
    marginTop: 2,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: theme.muted,
  },
  panel: { backgroundColor: theme.pink.surface, borderRadius: theme.radii.card, padding: 12, gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", margin: -3 },
  tileWide: { width: "50%", padding: 3 },
  tileThird: { width: "33.333%", padding: 3 },
  tile: {
    flex: 1,
    backgroundColor: theme.pink.background,
    borderRadius: theme.radii.tile,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  tileLabel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: theme.muted,
  },
  tileValue: { fontFamily: theme.fonts.monoMedium, fontSize: 22, lineHeight: 26, color: theme.text },
  tileUnit: { fontFamily: theme.fonts.monoMedium, fontSize: 12, color: theme.muted, marginLeft: 2 },
  tileText: { fontFamily: theme.fonts.bodySemi, fontSize: 16, lineHeight: 21, color: theme.text },
  eyebrow: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: theme.pink.accent,
  },
  secondary: {
    minHeight: 44,
    borderRadius: theme.radii.tile,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  linkButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  linkButtonText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
    color: theme.pink.accent,
    textAlign: "center",
  },
  secondaryText: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.text, textAlign: "center" },
  note: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: theme.muted },
  notice: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: theme.fuel },
  form: { gap: 0 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.pink.background,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  pillPink: { backgroundColor: "rgba(252,150,191,0.18)", borderColor: theme.pink.accent },
  pillGreen: { backgroundColor: "rgba(111,208,180,0.16)" },
  pillText: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.text },
  pillTextPink: { color: theme.pink.accent },
  pillTextGreen: { color: theme.green.accent },
  badge: { fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" },
  sportsLabel: { lineHeight: 20 },
  fieldTitle: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.text },
  fieldLabel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: theme.muted,
  },
  fields: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  field: { width: "50%", paddingHorizontal: 5, marginBottom: 10, gap: 4 },
  input: {
    minHeight: 44,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.pink.background,
    paddingHorizontal: 12,
    color: theme.text,
    fontFamily: theme.fonts.body,
    fontSize: 16,
  },
  inputMono: { fontFamily: theme.fonts.mono },
  slider: { position: "relative" },
  track: {
    position: "absolute",
    left: "16%",
    right: "16%",
    top: 14,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    flexDirection: "row",
  },
  stops: { flexDirection: "row" },
  stop: { flex: 1, alignItems: "center", minHeight: 44 },
  knobHit: { height: 32, alignItems: "center", justifyContent: "center" },
  knob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#48423f",
    borderWidth: 3,
    borderColor: theme.pink.surface,
  },
  knobOn: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.pink.accent },
  stopLabel: { fontFamily: theme.fonts.body, fontSize: 13, textAlign: "center", color: theme.muted },
  stopLabelOn: { fontFamily: theme.fonts.bodySemi, color: theme.text },
  stepper: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.pink.background,
    borderRadius: theme.radii.tile,
    padding: 2,
  },
  stepButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stepSymbol: { fontFamily: theme.fonts.monoMedium, fontSize: 22, color: theme.text },
  stepSymbolOff: { color: "#393330" },
  stepValue: {
    minWidth: 72,
    textAlign: "center",
    fontFamily: theme.fonts.monoMedium,
    fontSize: 18,
    color: theme.text,
  },
  stepUnit: { fontFamily: theme.fonts.monoMedium, fontSize: 12, color: theme.muted },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.pink.line,
    paddingVertical: 4,
  },
  rowCopy: { flex: 1 },
  rowLabel: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.text },
  rowHint: { marginTop: 2, fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  switchTrack: {
    width: 52,
    height: 32,
    borderRadius: theme.radii.pill,
    backgroundColor: "#393330",
  },
  switchTrackOn: { backgroundColor: theme.pink.accent },
  switchKnob: {
    position: "absolute",
    top: 3,
    left: 3,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.text,
  },
  switchKnobOn: { left: 23, backgroundColor: "#ffffff" },
  trackSwitch: {
    flexDirection: "row",
    backgroundColor: theme.pink.background,
    borderRadius: theme.radii.pill,
    padding: 3,
  },
  segment: {
    minHeight: 44,
    minWidth: 54,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentOn: { backgroundColor: theme.pink.accent },
  segmentText: { fontFamily: theme.fonts.bodySemi, fontSize: 13, color: theme.muted },
  segmentTextOn: { color: theme.pink.onAccent },
  testSound: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },
  testSoundPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  faqItem: { paddingTop: 9, paddingBottom: 7 },
  faqDivider: { borderTopWidth: 1, borderTopColor: theme.pink.line },
  faqQuestion: { justifyContent: "center" },
  faqQuestionText: { fontFamily: theme.fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: theme.text },
  faqAnswer: { marginTop: 4, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: theme.muted },
  disclaimer: { fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 18, color: theme.muted, marginTop: 4 },
  foot: { flexDirection: "row", gap: 8 },
  footButton: { flex: 1 },
  saveBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: theme.pink.background },
  saveBarClear: { marginBottom: 88 },
  save: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveOn: { backgroundColor: theme.pink.selectedFill },
  saveText: { fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  saveTextOn: { color: "#ffffff" },
  backdrop: { flex: 1, justifyContent: "flex-end", padding: 12 },
  backdropFill: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { backgroundColor: "#2f2a27", borderRadius: 20, padding: 18, gap: 12, zIndex: 1 },
  confirmTitle: {
    fontFamily: theme.fonts.display,
    fontSize: 26,
    lineHeight: 28,
    color: theme.text,
    textTransform: "uppercase",
  },
  confirmBody: { fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20, color: "#d4cfcc" },
  confirmButtons: { flexDirection: "row", gap: 10 },
  confirmCancel: { flex: 1, backgroundColor: "rgba(255,255,255,0.07)" },
  restore: {
    flex: 2,
    minHeight: 44,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.pink.selectedFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  danger: {
    flex: 2,
    minHeight: 44,
    borderRadius: theme.radii.tile,
    backgroundColor: "#c96a48",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dangerText: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: "#ffffff", textAlign: "center" },
});
