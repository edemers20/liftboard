/** Scroll this far in one direction before the header starts moving. */
export const HIDE_THRESHOLD = 8;

export type HideScroll = {
  offset: number;
  pending: number;
};

/** Move the header with the scroll, after an 8pt nudge in that direction. Clamped to the header height. */
export function stepHideScroll(state: HideScroll, y: number, dy: number, height: number): HideScroll {
  "worklet";
  if (height <= 0) return state;
  if (y <= 0) return { offset: 0, pending: 0 };
  if (dy === 0) return state;
  let pending = state.pending;
  if (pending !== 0 && Math.sign(dy) !== Math.sign(pending)) pending = 0;
  pending += dy;
  if (Math.abs(pending) < HIDE_THRESHOLD) return { offset: state.offset, pending };
  const excess = pending > 0 ? pending - HIDE_THRESHOLD : pending + HIDE_THRESHOLD;
  const offset = Math.min(height, Math.max(0, state.offset + excess));
  return { offset, pending: Math.sign(pending) * HIDE_THRESHOLD };
}

/** Fully shown or fully hidden, whichever is closer. At the top of the page, always shown. */
export function settleHideScroll(offset: number, y: number, height: number): number {
  "worklet";
  if (height <= 0 || y <= 0) return 0;
  return offset > height / 2 ? height : 0;
}
