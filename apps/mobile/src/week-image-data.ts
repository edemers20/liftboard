/** The copyable week image (layout A, Day strip): one capsule per day, PR and streak chips, upper and lower trend sparks. */

export type WeekImageDay = {
  /** Index into the Monday-first day letters. */
  weekday: number;
  lift: boolean;
  activity: boolean;
  pr: boolean;
};

export type WeekImageData = {
  start: number;
  days: WeekImageDay[];
  prs: number;
  streak: number;
  upper: number[] | null;
  lower: number[] | null;
};

type Session = { t?: number; k?: string };
type Half = { spark: number[] } | null | undefined;

/** Seven local days from `start`; calendar days, so a DST change doesn't shift the edges. */
export function weekDays(start: number, sessions: Session[], prTimes: number[]): WeekImageDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const open = new Date(start);
    open.setDate(open.getDate() + index);
    const close = new Date(open);
    close.setDate(close.getDate() + 1);
    const from = open.getTime();
    const to = close.getTime();
    const inDay = (t: number | undefined) => typeof t === "number" && t >= from && t < to;
    const today = sessions.filter((session) => inDay(session.t));
    return {
      weekday: (open.getDay() + 6) % 7,
      lift: today.some((session) => session.k === "lift"),
      activity: today.some((session) => !!session.k && session.k !== "lift"),
      pr: prTimes.some(inDay),
    };
  });
}

/** A spark needs two points to draw a line. */
function spark(half: Half): number[] | null {
  return half && half.spark.length > 1 ? half.spark : null;
}

export function buildWeekImage(input: {
  start: number;
  sessions: Session[];
  prTimes: number[];
  prs: number;
  streak: number;
  strength: { upper: Half; lower: Half };
}): WeekImageData {
  return {
    start: input.start,
    days: weekDays(input.start, input.sessions, input.prTimes),
    prs: input.prs,
    streak: input.streak,
    upper: spark(input.strength.upper),
    lower: spark(input.strength.lower),
  };
}
