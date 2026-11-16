/**
 * Decides when a sideways list has moved onto another item: one tick per item boundary crossed,
 * never more often than `minMs`, so a fast fling doesn't buzz continuously.
 */
export function createScrollTick(pitch: number, minMs = 60) {
  let index: number | null = null;
  let last = -Infinity;
  return (offset: number, now: number): boolean => {
    if (!(pitch > 0) || !Number.isFinite(offset)) return false;
    const next = Math.max(0, Math.round(offset / pitch));
    if (index === null) {
      index = next;
      return false;
    }
    if (next === index) return false;
    index = next;
    if (now - last < minMs) return false;
    last = now;
    return true;
  };
}
