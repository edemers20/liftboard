import { Image } from "expo-image";
import { StyleSheet, View, type ImageRequireSource } from "react-native";

import { exerciseImageSource, exerciseImagesOn } from "./index";

/** ~44pt square thumb beside an exercise name when Settings → Show exercise images is on. */
export function ExerciseThumb({ name, size = 44 }: { name: string; size?: number }) {
  if (!exerciseImagesOn()) return null;
  const source = exerciseImageSource(name) as ImageRequireSource | null;
  if (!source) return null;
  return (
    <View style={[styles.wrap, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={source} style={{ width: size, height: size }} contentFit="contain" recyclingKey={name} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 8, overflow: "hidden", backgroundColor: "transparent" },
});
