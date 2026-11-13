import { Platform } from "react-native";

import chimeAsset from "../assets/sounds/rest_chime.wav";

type ChimeContext = {
  currentTime: number;
  destination: unknown;
  resume?: () => Promise<void> | void;
  createOscillator: () => {
    type: string;
    frequency: { value: number };
    connect: (node: unknown) => void;
    start: (when: number) => void;
    stop: (when: number) => void;
  };
  createGain: () => {
    gain: {
      setValueAtTime: (value: number, time: number) => void;
      exponentialRampToValueAtTime: (value: number, time: number) => void;
    };
    connect: (node: unknown) => void;
  };
};

type ChimePlayer = {
  play: () => void;
  remove: () => void;
  addListener: (
    event: "playbackStatusUpdate",
    listener: (status: { didJustFinish: boolean }) => void,
  ) => { remove: () => void };
};

let player: ChimePlayer | null = null;
let subscription: { remove: () => void } | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;

/** Same three notes as the web chime. Mixes over other audio and does not hold the session. */
export function playChime(): void {
  if (Platform.OS === "web") {
    playWebChime();
    return;
  }
  void playNativeChime();
}

function playWebChime() {
  const host = globalThis as {
    AudioContext?: new () => ChimeContext;
    webkitAudioContext?: new () => ChimeContext;
    navigator?: { audioSession?: { type: string } };
  };
  try {
    const session = host.navigator?.audioSession;
    if (session && session.type !== "ambient") session.type = "ambient";
  } catch {
    // The playback session is an iOS web extra. The tones still play without it.
  }
  const Context = host.AudioContext || host.webkitAudioContext;
  if (!Context) return;
  const audio = new Context();
  void audio.resume?.();
  const start = audio.currentTime;
  (
    [
      [784, 0],
      [1047, 0.16],
      [1319, 0.32],
    ] as const
  ).forEach(([frequency, delay]) => {
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.type = "sine";
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(0.4, start + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.6);
    tone.connect(gain);
    gain.connect(audio.destination);
    tone.start(start + delay);
    tone.stop(start + delay + 0.65);
  });
}

async function playNativeChime() {
  const mine = ++generation;
  try {
    const { createAudioPlayer, setAudioModeAsync } = await import("expo-audio");
    // mixWithOthers plays over music. doNotMix pauses it. playsInSilentMode uses the
    // playback category so the ring switch on silent still plays the chime. The player
    // is released when the chime ends so the session does not stay active.
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
      allowsRecording: false,
    });
    if (mine !== generation) return;
    subscription?.remove();
    player?.remove();
    const next = createAudioPlayer(chimeAsset, { keepAudioSessionActive: false });
    player = next;
    subscription = next.addListener("playbackStatusUpdate", (status) => {
      if (!status.didJustFinish) return;
      releaseNative(mine);
    });
    if (releaseTimer) clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => releaseNative(mine), 1500);
    next.play();
  } catch {
    // A dev build from before expo-audio has no player. The next native build includes it.
  }
}

function releaseNative(mine: number) {
  if (mine !== generation) return;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
  subscription?.remove();
  subscription = null;
  player?.remove();
  player = null;
}
