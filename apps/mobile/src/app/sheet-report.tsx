import { useNavigation } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";

import { useSolidGlass } from "@/glass";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { rememberedWeekReport, ReportSheet, type Report } from "@/week-report";

/** Weekly report. Fills the large sheet; the body scrolls above the button bar. */
export default function ReportRoute() {
  const navigation = useNavigation();
  const solid = useSolidGlass();
  const version = useEngineStore((state) => state.version);
  const live = useMemo(() => engine.pendingWeekReport() as Report | null, [version]);
  const held = useRef<Report | null>(live ?? rememberedWeekReport());
  if (live) held.current = live;
  if (!held.current) held.current = rememberedWeekReport();
  const closed = useRef(false);

  useEffect(() => {
    const sub = (navigation as { addListener: (event: string, cb: () => void) => () => void }).addListener("beforeRemove", () => {
      if (closed.current) return;
      closed.current = true;
      engine.dismissWeekReport();
    });
    return () => sub();
  }, [navigation]);

  if (!held.current) return null;
  return (
    <View style={{ flex: 1, backgroundColor: solid ? theme.orange.background : "transparent" }}>
      <ReportSheet report={held.current} />
    </View>
  );
}
