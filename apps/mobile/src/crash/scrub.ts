/**
 * Crash reports carry what's needed to find the bug and nothing about the person: error types, scrubbed
 * messages, stack frames, and the app, OS and device model. Weights, reps, body stats, notes, names, routes and
 * anything the app put on the scope are dropped. It's an allowlist, so a field the SDK adds later stays out.
 */

type Json = Record<string, unknown>;

const FRAME_KEYS = [
  "filename",
  "abs_path",
  "module",
  "function",
  "lineno",
  "colno",
  "in_app",
  "platform",
  "package",
  "instruction_addr",
  "symbol_addr",
  "image_addr",
  "addr_mode",
] as const;
const CONTEXT_KEYS: Record<string, readonly string[]> = {
  os: ["name", "version", "build", "kernel_version"],
  device: ["family", "model", "model_id", "arch", "simulator", "memory_size", "free_memory", "orientation"],
  app: ["app_identifier", "app_name", "app_version", "app_build", "build_type", "app_start_time"],
};
const TOP_KEYS = ["event_id", "timestamp", "platform", "level", "release", "dist", "environment", "sdk", "fingerprint", "type"] as const;

const MAX_TEXT = 200;

/** Numbers and quoted text can hold a weight, a note or a name; only the shape of the message stays. */
export function scrubText(text: unknown): string | undefined {
  if (typeof text !== "string") return undefined;
  return text
    .replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, "$1…$1")
    .replace(/\d+(?:[.,]\d+)*/g, "#")
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<email>")
    .slice(0, MAX_TEXT);
}

function pick(source: unknown, keys: readonly string[]): Json | undefined {
  if (!source || typeof source !== "object") return undefined;
  const out: Json = {};
  for (const key of keys) {
    const value = (source as Json)[key];
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function stack(trace: unknown): Json | undefined {
  const frames = (trace as { frames?: unknown[] } | undefined)?.frames;
  if (!Array.isArray(frames)) return undefined;
  return { frames: frames.map((frame) => pick(frame, FRAME_KEYS) ?? {}) };
}

function exception(value: unknown): Json {
  const item = (value || {}) as Json;
  const mechanism = item.mechanism as Json | undefined;
  return {
    ...pick(item, ["type", "module", "thread_id"]),
    value: scrubText(item.value),
    stacktrace: stack(item.stacktrace),
    mechanism: mechanism ? pick(mechanism, ["type", "handled", "synthetic", "is_exception_group", "exception_id", "parent_id"]) : undefined,
  };
}

/** Sentry's `beforeSend`: returns a new event with only the allowed fields. */
export function scrubEvent<Event extends object>(event: Event): Event {
  const source = event as Json;
  const out: Json = { ...pick(source, TOP_KEYS) };

  const values = (source.exception as { values?: unknown[] } | undefined)?.values;
  if (Array.isArray(values)) out.exception = { values: values.map(exception) };

  const threads = (source.threads as { values?: unknown[] } | undefined)?.values;
  if (Array.isArray(threads)) {
    out.threads = {
      values: threads.map((thread) => ({ ...pick(thread, ["id", "crashed", "current", "main"]), stacktrace: stack((thread as Json).stacktrace) })),
    };
  }

  if (source.message !== undefined) {
    const message = source.message as string | { formatted?: string; message?: string };
    out.message = scrubText(typeof message === "string" ? message : message.formatted ?? message.message);
  }

  const contexts: Json = {};
  for (const [name, keys] of Object.entries(CONTEXT_KEYS)) {
    const picked = pick((source.contexts as Json | undefined)?.[name], keys);
    if (picked) contexts[name] = picked;
  }
  if (Object.keys(contexts).length) out.contexts = contexts;

  // Symbol images only: needed to read native stacks.
  const images = (source.debug_meta as { images?: unknown[] } | undefined)?.images;
  if (Array.isArray(images)) out.debug_meta = { images };

  return out as Event;
}
