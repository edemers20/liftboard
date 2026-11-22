/**
 * When the in-app rest-end cue (buzz and chime) plays. No React Native imports, so it runs in tests.
 *
 * Same rule as the web: cue once per rest end, only with the app open, and only if rest ended in the
 * last 3 seconds. A rest that ended while the app was away was already announced by the lock screen
 * alert, so coming back to it stays quiet.
 */
export const REST_CUE_WINDOW_MS = 3000;

export type RestView = { over: boolean; seconds: number; why: string; end: number };

/** Same numbers as engine.restView, without clearing an expired timer during render. */
export function peekRest(rest: { end?: number; why?: string } | null | undefined, now: number): RestView | null {
  if (!rest?.end) return null;
  const left = (rest.end - now) / 1000;
  if (left < -300) return null;
  if (left <= 0) return { over: true, seconds: 0, why: rest.why || "", end: rest.end };
  return { over: false, seconds: Math.round(left), why: rest.why || "", end: rest.end };
}

export function restCueDue(end: number, now: number, active: boolean, cuedEnd: number): boolean {
  if (!end || !Number.isFinite(end) || end === cuedEnd || !active) return false;
  return now >= end && now - end <= REST_CUE_WINDOW_MS;
}

/** Milliseconds to wait before checking for the rest end again; null when there is nothing to wait for. */
export function restCueWait(end: number, now: number): number | null {
  if (!end || !Number.isFinite(end) || end <= now) return null;
  return end - now + 30;
}
