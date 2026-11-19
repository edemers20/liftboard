"use no memo";

import { useLocalSearchParams } from "expo-router";

import { Probe } from "@/perf/probe";
import { WorkoutScreen } from "@/workout/screen";

export default function WorkoutRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id || "";
  return (
    <Probe id="workout">
      <WorkoutScreen id={id} />
    </Probe>
  );
}
