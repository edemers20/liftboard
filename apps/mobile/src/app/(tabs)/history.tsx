import { useMemo } from "react";

import { HistoryTab } from "@/components/history-tab";
import { readHistory } from "@/history-data";
import { useEngineStore } from "@/store";

export default function HistoryScreen() {
  const version = useEngineStore((state) => state.version);
  const data = useMemo(() => readHistory(), [version]);
  return <HistoryTab data={data} />;
}
