"use no memo";

import { ProfileScreen } from "@/components/profile-screen";
import { Probe } from "@/perf/probe";

export default function YouScreen() {
  return (
    <Probe id="tab:you">
      <ProfileScreen />
    </Probe>
  );
}
