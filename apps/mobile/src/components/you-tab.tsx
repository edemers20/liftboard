import { useEffect, useState } from "react";
import { File, Paths } from "expo-file-system";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type AccessibilityRole,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { applyBackup, parseBackup, type LiftBackup } from "@/backup";
import { playChime } from "@/chime";
import { SheetFrame } from "@/components/motion";
import { ageDial, bodyFatDial, DialValue, heightDial, stepsDial, weightDial, type DialSpec } from "@/components/number-dial";
import { copy, fill } from "@/copy";
import { haptic } from "@/haptic";
import { Info } from "@/icons";
import { storage } from "@/storage";
import { engine, useEngineStore } from "@/store";
import { rollWeekIfDue } from "@/week-roll";
import { theme } from "@/theme";
import { fromDisplay, toDisplay } from "@/units";
const SESSION_MINUTES = [30, 45, 60, 75] as const;
const LEVELS = ["new", "some", "years"] as const;
const FOCUS = ["Lower", "Balanced", "Upper"] as const;
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
  liftK?: string;
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
  liftK: string;
};

type InfoItem = { label: string; body: string };

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
    liftK: draft?.liftK ?? str(week.liftK),
  };
}

function matchesSaved(key: keyof Draft, value: unknown) {
  const week = engine.wk;
  if (key === "ss" || key === "sound") return value === (week[key] || "Yes");
  if (key === "stretch") return value === (week.stretch || "No");
  if (key === "level") return value === levelKey(week);
  if (key === "time") return Number(value) === (Number(week.time) || 60);
  if (key === "liftK") return str(value) === str(week.liftK);
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

/** The profile is read from the engine module, which the compiler would treat as constant. */
export function YouTab({ onReplay }: { onReplay: () => void }) {
  "use no memo";
  useEngineStore((state) => state.version);
  const call = useEngineStore((state) => state.call);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [liftText, setLiftText] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<Record<number, boolean>>({});
  const [info, setInfo] = useState<InfoItem[] | null>(null);
  const [confirm, setConfirm] = useState<null | "reset" | "delete" | "restore">(null);
  const [pending, setPending] = useState<LiftBackup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  function pickSport(id: string) {
    let main = form.mainSport || "";
    let second = form.sport2 || "";
    if (!id) {
      main = "";
      second = "";
    } else if (id === main) {
      main = second;
      second = "";
    } else if (id === second) {
      second = main;
      main = id;
    } else if (!main) main = id;
    else second = id;
    const fixed = { acts: form.acts, mainSport: main, sport2: second, season: form.season };
    engine.fixSports(fixed);
    stage({ mainSport: fixed.mainSport, sport2: fixed.sport2, season: fixed.season });
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
  const name = str(week.name).trim() || copy.tabs.you;
  const sessions = (week.sessions || []) as { t: number; k: string }[];
  const lifts = sessions.filter((session) => session.k === "lift").length;
  const weeks = new Set(sessions.map((session) => engine.weekStartOf(session.t).getTime())).size;
  const tags = (engine.ACT_IDS as string[])
    .filter((id) => id !== "lift" && engine.enabled(id))
    .sort((a, b) => Number(b === week.mainSport) - Number(a === week.mainSport));
  const sports = ([...(engine.SPORTS as string[]), "yoga", "pilates"] as string[]).filter((id) => form.acts[id]);
  const sessionIndex = Math.max(0, SESSION_MINUTES.indexOf(Number(form.time) as (typeof SESSION_MINUTES)[number]));
  const session = SESSION_MINUTES[sessionIndex];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.hero}>
          <View style={styles.who}>
            <Avatar letter={name.slice(0, 1).toUpperCase()} />
            <View style={styles.whoText}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.since}>{copy.you.memberSince(memberSince(week))}</Text>
            </View>
          </View>
          {tags.length ? (
            <View style={styles.tags}>
              {tags.map((id) => (
                <View key={id} style={styles.tag}>
                  <Text style={styles.tagText}>
                    {activityName(id)}
                    {id === week.mainSport && engine.inSeason() ? copy.you.inSeason : ""}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.stats}>
            <Stat value={String(lifts)} label={copy.you.lifts} />
            <Stat value={String(sessions.length - lifts)} label={copy.you.activities} />
            <Stat value={String(weeks)} label={copy.you.weeksActive} />
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.grid}>
            {profileTiles(kgMode, true).map((tile) => (
              <View key={tile.label} style={tile.wide ? styles.tileWide : styles.tileThird}>
                <View accessible style={styles.tile}>
                  <Text style={styles.tileLabel}>{tile.label}</Text>
                  {tile.text ? (
                    <Text style={styles.tileText}>{tile.value}</Text>
                  ) : (
                    <Text style={styles.tileValue} numberOfLines={1}>
                      {tile.value}
                      {tile.unit ? <Text style={styles.tileUnit}>{tile.unit}</Text> : null}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
          {editing ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: false }}
            onPress={() => setEditing(true)}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>{copy.you.viewPreferences}</Text>
          </Pressable>
          )}
          {editing ? (
            <ProfileForm
              form={form}
              kgMode={kgMode}
              onStage={stage}
              onSport={pickSport}
              sports={sports}
              onInfo={setInfo}
            />
          ) : null}
        </View>

        {editing && engine.enabled("lift") ? (
          <View style={styles.panel}>
            <Heading
              title={copy.you.trainingPreferences}
              onInfo={() =>
                setInfo([
                  { label: copy.you.supersets, body: copy.info.supersets },
                  { label: copy.you.avgLiftKcal, body: copy.info.avgLiftKcal },
                ])
              }
            />
            <Text style={styles.fieldTitle}>{copy.you.experience}</Text>
            <ExperienceSlider value={form.level} onChange={(level) => stage({ level })} />
            <Text style={styles.fieldTitle}>{copy.you.sessionLength}</Text>
            <View accessibilityLabel={copy.you.sessionLength} style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${copy.you.decrease} to ${SESSION_MINUTES[sessionIndex - 1] ?? session} ${copy.you.min}`}
                disabled={sessionIndex === 0}
                onPress={() => stage({ time: SESSION_MINUTES[sessionIndex - 1] })}
                style={styles.stepButton}
              >
                <Text style={[styles.stepSymbol, sessionIndex === 0 && styles.stepSymbolOff]}>−</Text>
              </Pressable>
              <Text style={styles.stepValue}>
                {session}
                <Text style={styles.stepUnit}> {copy.you.min}</Text>
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${copy.you.increase} to ${SESSION_MINUTES[sessionIndex + 1] ?? session} ${copy.you.min}`}
                disabled={sessionIndex === SESSION_MINUTES.length - 1}
                onPress={() => stage({ time: SESSION_MINUTES[sessionIndex + 1] })}
                style={styles.stepButton}
              >
                <Text
                  style={[
                    styles.stepSymbol,
                    sessionIndex === SESSION_MINUTES.length - 1 && styles.stepSymbolOff,
                  ]}
                >
                  +
                </Text>
              </Pressable>
            </View>
            <Toggle
              label={copy.you.supersets}
              on={form.ss === "Yes"}
              onPress={() => stage({ ss: form.ss === "Yes" ? "No" : "Yes" })}
            />
            <Toggle
              label={copy.you.stretchingAfterLifts}
              on={form.stretch === "Yes"}
              onPress={() => stage({ stretch: form.stretch === "Yes" ? "No" : "Yes" })}
            />
            <Toggle
              label={copy.you.restTimerSound}
              on={form.sound === "Yes"}
              onPress={() => stage({ sound: form.sound === "Yes" ? "No" : "Yes" })}
            />
            {form.sound === "Yes" ? (
              <Pressable accessibilityRole="button" onPress={playChime} style={styles.testSound}>
                <Text style={styles.secondaryText}>{copy.you.playTestSound}</Text>
              </Pressable>
            ) : null}
            <Text style={styles.fieldTitle}>{copy.you.avgLiftKcal}</Text>
            <TextInput
              accessibilityLabel={copy.you.avgLiftKcal}
              value={liftText ?? form.liftK}
              onChangeText={setLiftText}
              onEndEditing={(event) => {
                setLiftText(null);
                stage({ liftK: event.nativeEvent.text });
              }}
              keyboardType="number-pad"
              inputMode="numeric"
              style={[styles.input, styles.kcalInput]}
            />
          </View>
        ) : null}

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
            hint={copy.you.weekStartsHint}
            value={week.wkStart === "Sun" ? "Sun" : "Mon"}
            options={[
              ["Mon", copy.you.mon],
              ["Sun", copy.you.sun],
            ]}
            onChange={(value) => call((api) => api.setWeekStart(value))}
          />
          <TwoWay
            label={copy.you.nextMorning}
            hint={copy.you.nextMorningHint}
            value={(week.remind || "On") === "Off" ? "Off" : "On"}
            options={[
              ["On", copy.you.on],
              ["Off", copy.you.off],
            ]}
            onChange={(value) => write("remind", value)}
          />
        </View>

        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.eyebrow}>
            {copy.you.faq}
          </Text>
          {copy.faq.map(([question, answer], index) => {
            const open = !!openFaq[index];
            return (
              <View key={question} style={index === 0 ? undefined : styles.faqDivider}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setOpenFaq((prev) => ({ ...prev, [index]: !prev[index] }))}
                  style={styles.faqQuestion}
                >
                  <Text style={styles.faqQuestionText}>{question}</Text>
                </Pressable>
                {open ? <Text style={styles.faqAnswer}>{answer}</Text> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.eyebrow}>
            {copy.you.yourData}
          </Text>
          {__DEV__ ? (
            <>
              <Text style={styles.note}>{copy.you.backupNote}</Text>
              <Pressable accessibilityRole="button" onPress={() => void chooseBackup()} style={styles.secondary}>
                <Text style={styles.secondaryText}>{copy.you.restoreBackup}</Text>
              </Pressable>
              {notice ? (
                <Text accessibilityRole="alert" style={styles.notice}>
                  {notice}
                </Text>
              ) : null}
            </>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => void exportData()} style={styles.secondary}>
            <Text style={styles.secondaryText}>{copy.you.exportData}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setConfirm("delete")} style={styles.secondary}>
            <Text style={styles.secondaryText}>{copy.you.deleteAccount}</Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>{copy.you.disclaimer}</Text>
        <View style={styles.foot}>
          <Pressable accessibilityRole="button" onPress={onReplay} style={[styles.secondary, styles.footButton]}>
            <Text style={styles.secondaryText}>{copy.you.replayTour}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirm("reset")}
            style={[styles.secondary, styles.footButton]}
          >
            <Text style={styles.secondaryText}>{copy.you.resetProfile}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {editing ? (
        <View style={styles.saveBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => (changed ? saveProfile() : closeEdit())}
            style={[styles.save, changed ? styles.saveOn : styles.secondary]}
          >
            <Text style={[styles.saveText, changed ? styles.saveTextOn : styles.secondaryText]}>
              {changed ? copy.you.saveClose : copy.you.close}
            </Text>
          </Pressable>
        </View>
      ) : null}
      </KeyboardAvoidingView>

      <SheetFrame
        visible={info != null || confirm != null}
        label={copy.you.close}
        onClose={() => {
          setInfo(null);
          setConfirm(null);
          setPending(null);
        }}
      >
          <View style={styles.sheet}>
            {confirm ? (
              <>
                <Text style={styles.eyebrow}>{copy.you.areYouSure}</Text>
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
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setConfirm(null);
                      setPending(null);
                    }}
                    style={[styles.secondary, styles.confirmCancel]}
                  >
                    <Text style={styles.secondaryText}>{copy.you.cancel}</Text>
                  </Pressable>
                  <Pressable
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
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                {info?.map((item) => (
                  <View key={item.label}>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={styles.infoBody}>{item.body}</Text>
                  </View>
                ))}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setInfo(null)}
                  style={styles.secondary}
                >
                  <Text style={styles.secondaryText}>{copy.you.close}</Text>
                </Pressable>
              </>
            )}
          </View>
      </SheetFrame>
    </SafeAreaView>
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

function Heading({ title, onInfo }: { title: string; onInfo: () => void }) {
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.eyebrow}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.you.whatTheseDo}
        onPress={onInfo}
        hitSlop={4}
        style={styles.infoButton}
      >
        <Info size={16} color="#d4cfcc" />
      </Pressable>
    </View>
  );
}

function ExperienceSlider({ value, onChange }: { value: string; onChange: (level: string) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={copy.you.experience} style={styles.slider}>
      <View pointerEvents="none" style={styles.track}>
        {Array.from({ length: 12 }, (_, index) => (
          <View key={index} style={{ flex: 1, backgroundColor: mix("#6fd0b4", "#e9b69b", index / 11) }} />
        ))}
      </View>
      <View style={styles.stops}>
        {LEVELS.map((level) => {
          const selected = level === value;
          const label = lookup(copy.levels, level) ?? level;
          return (
            <Pressable
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      aria-checked={on}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={styles.row}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View pointerEvents="none" style={[styles.switchTrack, on && styles.switchTrackOn]}>
        <View style={[styles.switchKnob, on && styles.switchKnobOn]} />
      </View>
    </Pressable>
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
            <Pressable
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ProfileForm({
  form,
  kgMode,
  onStage,
  onSport,
  sports,
  onInfo,
}: {
  form: Source;
  kgMode: boolean;
  onStage: (partial: Draft) => void;
  onSport: (id: string) => void;
  sports: string[];
  onInfo: (items: InfoItem[]) => void;
}) {
  const activityInfo: InfoItem[] = [
    { label: copy.you.activities, body: copy.info.activities },
    { label: copy.you.mainSport, body: copy.info.mainSport },
  ];
  if (form.mainSport && form.acts[form.mainSport]) {
    activityInfo.push({ label: copy.you.season, body: copy.info.season });
  }

  return (
    <View style={styles.form}>
      <View style={styles.group}>
        <Heading title={copy.you.activities} onInfo={() => onInfo(activityInfo)} />
        <View style={styles.pills}>
          {(engine.ACT_IDS as string[]).map((id) => (
            <Pill
              key={id}
              label={activityName(id)}
              selected={!!form.acts[id]}
              tone="pink"
              onPress={() => onStage({ acts: { ...form.acts, [id]: !form.acts[id] } })}
            />
          ))}
        </View>
      </View>
      {sports.length ? (
        <View style={styles.group}>
          <Text style={styles.sportsLabel}>
            <Text style={styles.fieldTitle}>{copy.you.sportsInSeason}</Text>
            <Text style={styles.rowHint}>{copy.you.sportsHint}</Text>
          </Text>
          <View style={styles.pills}>
            <Pill label={copy.you.none} selected={!form.mainSport} tone="pink" onPress={() => onSport("")} />
            {sports.map((id) => {
              const primary = form.mainSport === id && !!form.sport2;
              return (
                <Pill
                  key={id}
                  label={activityName(id)}
                  badge={primary ? copy.you.primary : undefined}
                  selected={form.mainSport === id || form.sport2 === id}
                  tone="pink"
                  onPress={() => onSport(id)}
                />
              );
            })}
          </View>
        </View>
      ) : null}
      {form.acts.lift ? (
        <View style={styles.group}>
          <Heading
            title={copy.you.lifting}
            onInfo={() => onInfo([{ label: copy.you.focus, body: copy.info.focus }])}
          />
          {form.days === "0" ? null : (
            <>
              <Text style={styles.fieldTitle}>{copy.you.focus}</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel={copy.you.focus} style={styles.pills}>
                {FOCUS.map((id) => (
                  <Pill
                    key={id}
                    label={lookup(copy.focus, id) ?? id}
                    selected={form.focus === id}
                    tone="green"
                    onPress={() => onStage({ focus: id })}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      ) : null}
      <View style={styles.group}>
        <Heading
          title={copy.you.bioData}
          onInfo={() =>
            onInfo([
              { label: copy.you.sex, body: copy.info.sex },
              { label: copy.you.age, body: copy.info.restingMetabolism },
              { label: copy.you.height, body: copy.info.height },
              { label: copy.you.weight, body: copy.info.weight },
              { label: copy.you.bodyFat, body: copy.info.bodyFat },
              { label: copy.you.steps, body: copy.info.steps },
              { label: copy.you.dailyBurn, body: copy.info.dailyBurn },
            ])
          }
        />
        <Text style={styles.fieldTitle}>{copy.you.sex}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={copy.you.sex} style={styles.pills}>
          {SEX.map((id) => (
            <Pill
              key={id}
              label={lookup(copy.sex, id) ?? id}
              selected={form.sex === id}
              tone="green"
              onPress={() => onStage({ sex: id })}
            />
          ))}
        </View>
        <View style={styles.fields}>
          <Field label={copy.you.name} value={form.name} placeholder={copy.onboarding.optional} onChange={(name) => onStage({ name })} />
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
            label={copy.you.stepsPerDay}
            value={form.steps}
            dial={stepsDial}
            start={form.steps.trim() ? undefined : Number(copy.onboarding.stepsExample.replace(/[^\d]/g, "")) || undefined}
            onChange={(steps) => onStage({ steps })}
          />
          <Field
            label={copy.you.dailyBurn}
            value={form.oura}
            placeholder={copy.onboarding.optional}
            keyboard="number-pad"
            onChange={(oura) => onStage({ oura })}
          />
        </View>
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={[styles.pill, selected && (tone === "pink" ? styles.pillPink : styles.pillGreen)]}
    >
      <Text style={[styles.pillText, selected && (tone === "pink" ? styles.pillTextPink : styles.pillTextGreen)]}>
        {label}
        {badge ? <Text style={styles.badge}> {badge}</Text> : null}
      </Text>
    </Pressable>
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
  screen: { flex: 1, backgroundColor: theme.orange.background },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28, gap: 10 },
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
  stat: { flex: 1, backgroundColor: theme.orange.surface, borderRadius: 14, padding: 12 },
  statValue: { fontFamily: theme.fonts.monoMedium, fontSize: 22, color: theme.text },
  statLabel: {
    marginTop: 2,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: theme.muted,
  },
  panel: { backgroundColor: theme.orange.surface, borderRadius: theme.radii.card, padding: 12, gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", margin: -3 },
  tileWide: { width: "50%", padding: 3 },
  tileThird: { width: "33.333%", padding: 3 },
  tile: {
    flex: 1,
    backgroundColor: theme.orange.background,
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
    color: theme.orange.accent,
  },
  heading: { flexDirection: "row", alignItems: "center" },
  infoButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  secondary: {
    minHeight: 44,
    borderRadius: theme.radii.tile,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryText: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.text, textAlign: "center" },
  note: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: theme.muted },
  notice: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: theme.fuel },
  form: { gap: 4 },
  group: { borderTopWidth: 1, borderTopColor: "#433d39", paddingTop: 16, gap: 10 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.orange.background,
    alignItems: "center",
    justifyContent: "center",
  },
  pillPink: { backgroundColor: "rgba(252,150,191,0.18)" },
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
    backgroundColor: theme.orange.background,
    paddingHorizontal: 12,
    color: theme.text,
    fontFamily: theme.fonts.body,
    fontSize: 16,
  },
  inputMono: { fontFamily: theme.fonts.mono },
  kcalInput: { maxWidth: 120 },
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
    borderColor: theme.orange.surface,
  },
  knobOn: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.orange.accent },
  stopLabel: { fontFamily: theme.fonts.body, fontSize: 13, textAlign: "center", color: theme.muted },
  stopLabelOn: { fontFamily: theme.fonts.bodySemi, color: theme.text },
  stepper: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.orange.background,
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
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowCopy: { flex: 1 },
  rowLabel: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.text },
  rowHint: { marginTop: 2, fontFamily: theme.fonts.body, fontSize: 12, color: theme.muted },
  switchTrack: {
    width: 52,
    height: 32,
    borderRadius: theme.radii.pill,
    backgroundColor: "#393330",
  },
  switchTrackOn: { backgroundColor: theme.orange.selectedFill },
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
    backgroundColor: theme.orange.background,
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
  segmentOn: { backgroundColor: theme.orange.selectedFill },
  segmentText: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.muted },
  segmentTextOn: { color: "#ffffff" },
  testSound: {
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  faqDivider: { borderTopWidth: 1, borderTopColor: "#393330" },
  faqQuestion: { minHeight: 44, justifyContent: "center" },
  faqQuestionText: { fontFamily: theme.fonts.bodyMedium, fontSize: 14, color: theme.text },
  faqAnswer: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18, color: theme.muted, paddingBottom: 12 },
  disclaimer: { fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 18, color: theme.muted, marginTop: 4 },
  foot: { flexDirection: "row", gap: 8 },
  footButton: { flex: 1 },
  saveBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: theme.orange.background },
  save: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveOn: { backgroundColor: theme.orange.selectedFill },
  saveText: { fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  saveTextOn: { color: "#ffffff" },
  backdrop: { flex: 1, justifyContent: "flex-end", padding: 12 },
  backdropFill: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { backgroundColor: "#2f2a27", borderRadius: 20, padding: 18, gap: 12, zIndex: 1 },
  infoLabel: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.text },
  infoBody: { marginTop: 2, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20, color: "#d4cfcc" },
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
    backgroundColor: theme.orange.selectedFill,
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
