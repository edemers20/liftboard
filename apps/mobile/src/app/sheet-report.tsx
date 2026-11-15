import { useNavigation } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";

import { useSolidGlass } from "@/glass";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { ReportSheet, type Report } from "@/week-report";

/** Weekly report. A large detent that can expand to full height. */
export default function ReportRoute() {
  const navigation = useNavigation();
  const solid = useSolidGlass();
  const version = useEngineStore((state) => state.version);
  const live = useMemo(() => engine.pendingWeekReport() as Report | null, [version]);
  const held = useRef(live);
  if (live) held.current = live;
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
