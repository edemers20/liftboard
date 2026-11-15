import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { SettingsScreen } from "@/components/you-tab";
import { theme } from "@/theme";
import { useReduceMotion } from "@/use-reduce-motion";

export default function SettingsRoute() {
  const router = useRouter();
  const reduce = useReduceMotion();
  const params = useLocalSearchParams<{ edit?: string }>();
  return (
    <>
      <Stack.Screen
        options={{
          animation: reduce ? "fade" : "slide_from_right",
          contentStyle: { backgroundColor: theme.pink.background },
        }}
      />
      <SettingsScreen
        startMetrics={params.edit === "metrics"}
        onReplay={() => router.push("/onboarding")}
      />
    </>
  );
}
