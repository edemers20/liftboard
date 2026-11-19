import type { ImageSourcePropType } from "react-native";

import { engine } from "@/store";

import { EXERCISE_IMAGE_ASSETS } from "./assets";
import { EXERCISE_IMAGE_SLUGS } from "./slug-map";

/** Settings toggle; default off when unset. */
export function exerciseImagesOn(): boolean {
  return (engine.wk.exImg || "Off") === "On";
}

/**
 * Bundled frame-1 for a library exercise name, or null.
 * Custom / unmapped / empty names never get an image.
 */
export function exerciseImageSource(name: string | null | undefined): ImageSourcePropType | null {
  if (!name || name === engine.CUSTOM || name === "Custom exercise") return null;
  const slug = EXERCISE_IMAGE_SLUGS[name];
  if (!slug) return null;
  return EXERCISE_IMAGE_ASSETS[slug] ?? null;
}
