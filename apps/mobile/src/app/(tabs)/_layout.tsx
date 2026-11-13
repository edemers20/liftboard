import { Tabs } from "expo-router/js-tabs";

import { copy } from "@/copy";
import { TabHistory, TabPlan, TabWorkouts, TabYou } from "@/icons";
import { theme } from "@/theme";
import { useReduceMotion } from "@/use-reduce-motion";

function tint(color: unknown) {
  return typeof color === "string" ? color : theme.muted;
}

function bar(background: string) {
  return {
    backgroundColor: background,
    borderTopWidth: 0,
    elevation: 0,
  } as const;
}

export default function TabLayout() {
  const reduceMotion = useReduceMotion();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? "fade" : "shift",
        tabBarInactiveTintColor: theme.muted,
        tabBarActiveTintColor: theme.orange.accent,
        tabBarStyle: bar(theme.orange.background),
        tabBarLabelStyle: {
          fontFamily: theme.fonts.bodyMedium,
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: copy.tabs.workouts,
          tabBarIcon: ({ color }) => <TabWorkouts size={22} color={tint(color)} />,
          tabBarActiveTintColor: theme.green.accent,
          tabBarStyle: bar(theme.green.background),
          sceneStyle: { backgroundColor: theme.green.background },
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: copy.tabs.plan,
          tabBarIcon: ({ color }) => <TabPlan size={22} color={tint(color)} />,
          sceneStyle: { backgroundColor: theme.orange.background },
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: copy.tabs.history,
          tabBarIcon: ({ color }) => <TabHistory size={22} color={tint(color)} />,
          sceneStyle: { backgroundColor: theme.orange.background },
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: copy.tabs.you,
          tabBarIcon: ({ color }) => <TabYou size={22} color={tint(color)} />,
          sceneStyle: { backgroundColor: theme.orange.background },
        }}
      />
      <Tabs.Screen
        name="activity/[t]"
        options={{
          href: null,
          animation: reduceMotion ? "fade" : "shift",
          sceneStyle: { backgroundColor: theme.pink.background },
        }}
      />
    </Tabs>
  );
}
