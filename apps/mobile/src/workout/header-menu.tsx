import { Pressable, StyleSheet, Text, View } from "react-native";

import { GlassSheet } from "@/components/glass-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { copy } from "@/copy";
import { theme } from "@/theme";

export type MenuItem = { key: string; label: string; onPress: () => void; disabled?: boolean };

/**
 * Dropdown under the workout header's menu button. Drawn inside the screen rather than in a Modal, so an item
 * that opens a sheet (reset, swap) never presents while another modal is still dismissing.
 */
export function HeaderMenu({ open, top, items, onClose }: { open: boolean; top: number; items: MenuItem[]; onClose: () => void }) {
  if (!open) return null;
  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={onClose} style={StyleSheet.absoluteFill} />
      <GlassSheet accessibilityRole="menu" style={[styles.card, { top }]}>
        {items.map((item, index) => (
          <PressableScale
            key={item.key}
            kind="surface"
            accessibilityRole="menuitem"
            accessibilityState={{ disabled: !!item.disabled }}
            disabled={item.disabled}
            onPress={() => {
              onClose();
              item.onPress();
            }}
            style={[styles.item, index > 0 && styles.divider]}
          >
            <Text style={[styles.label, item.disabled && styles.labelOff]}>{item.label}</Text>
          </PressableScale>
        ))}
      </GlassSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 },
  card: {
    position: "absolute",
    right: 16,
    minWidth: 220,
    paddingVertical: 4,
    borderRadius: theme.radii.card,
    backgroundColor: "#232e2a",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  item: { minHeight: 48, paddingHorizontal: 16, justifyContent: "center" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(168,160,156,0.25)" },
  label: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  labelOff: { color: theme.muted },
});
