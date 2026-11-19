"use no memo";

import { useMemo } from "react";

import { HistoryTab } from "@/components/history-tab";
import { readHistory } from "@/history-data";
import { Probe } from "@/perf/probe";
import { useEngineVersion } from "@/screen-version";

export default function HistoryScreen() {
  const version = useEngineVersion();
  const data = useMemo(() => readHistory(), [version]);
  return (
    <Probe id="tab:history">
      <HistoryTab data={data} />
    </Probe>
  );
}
