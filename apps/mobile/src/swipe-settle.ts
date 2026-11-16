/** Width of the Delete button behind a row. */
export const SWIPE_WIDTH = 88;

/** Where the row sits while dragging: never right of closed, never past fully open. */
export function swipeDrag(start: number, dx: number, width = SWIPE_WIDTH): number {
  "worklet";
  const x = start + (Number.isFinite(dx) ? dx : 0);
  return Math.min(0, Math.max(-width, x));
}

/**
 * Where the row comes to rest when the finger lifts or the gesture is cancelled: fully closed (0)
 * or fully open (-width), never in between. A flick carries it the way it was going.
 */
export function swipeSettle(x: number, vx: number, width = SWIPE_WIDTH): number {
  "worklet";
  const at = Number.isFinite(x) ? x : 0;
  const velocity = Number.isFinite(vx) ? vx : 0;
  if (velocity < -500) return -width;
  if (velocity > 500) return 0;
  return at + velocity * 0.1 <= -width / 2 ? -width : 0;
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
