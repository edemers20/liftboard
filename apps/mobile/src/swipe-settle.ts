/** Width of the Delete button behind a row. */
export const SWIPE_WIDTH = 88;

/*
 * These run on the UI thread. A worklet's captured constants are unpacked inside its body, after
 * default parameters are evaluated, so a default like `width = SWIPE_WIDTH` is undefined there.
 * Read module constants in the body instead (worklets-ui-thread.test.ts runs them the UI-thread way).
 */

/**
 * How far left a full swipe goes before letting go deletes the row (iOS Mail style): past twice the
 * button and over half the row. A row too narrow for that, or not measured yet, has no full swipe.
 */
export function swipeFullAt(rowWidth: number, width?: number): number {
  "worklet";
  const w = width ?? SWIPE_WIDTH;
  return Number.isFinite(rowWidth) && rowWidth > w * 2 ? Math.max(w * 2, rowWidth * 0.55) : Infinity;
}

/** Where the row sits while dragging: never right of closed; up to the row's width when it can full-swipe, else fully open. */
export function swipeDrag(start: number, dx: number, width?: number, rowWidth?: number): number {
  "worklet";
  const w = width ?? SWIPE_WIDTH;
  const row = rowWidth ?? 0;
  const limit = swipeFullAt(row, w) === Infinity ? w : row;
  const x = start + (Number.isFinite(dx) ? dx : 0);
  return Math.min(0, Math.max(-limit, x));
}

/**
 * Where the row comes to rest when the finger lifts or the gesture is cancelled: fully closed (0),
 * fully open (-width), or off the row's left edge (-rowWidth) when let go past the full-swipe point,
 * which deletes. Never in between. A flick carries it the way it was going, but only a full swipe deletes.
 */
export function swipeSettle(x: number, vx: number, width?: number, rowWidth?: number): number {
  "worklet";
  const w = width ?? SWIPE_WIDTH;
  const row = rowWidth ?? 0;
  const at = Number.isFinite(x) ? x : 0;
  const velocity = Number.isFinite(vx) ? vx : 0;
  if (at <= -swipeFullAt(row, w)) return -row;
  if (velocity < -500) return -w;
  if (velocity > 500) return 0;
  return at + velocity * 0.1 <= -w / 2 ? -w : 0;
}

/** Delete shows only while the row is moved off its resting place. */
export function swipeActionShown(x: number): boolean {
  "worklet";
  return x < -0.5;
}

type Rect = { x: number; y: number; width: number; height: number };

/** One row open at a time. Tapping or scrolling anywhere else closes it. */
export function createSwipeRegistry() {
  let open: { key: object; close: () => void; rect: Rect | null } | null = null;
  return {
    /** A row started moving or settled open: any other open row closes. */
    claim(key: object, close: () => void) {
      if (open && open.key !== key) open.close();
      open = { key, close, rect: open?.key === key ? open.rect : null };
    },
    setRect(key: object, rect: Rect) {
      if (open?.key === key) open.rect = rect;
    },
    release(key: object) {
      if (open?.key === key) open = null;
    },
    /** A touch began at (x, y). Closes the open row unless the touch is on its Delete button. */
    touch(x: number, y: number) {
      if (!open) return;
      const r = open.rect;
      if (r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return;
      const close = open.close;
      open = null;
      close();
    },
    closeAll() {
      const close = open?.close;
      open = null;
      close?.();
    },
    isOpen: (key: object) => open?.key === key,
  };
}
