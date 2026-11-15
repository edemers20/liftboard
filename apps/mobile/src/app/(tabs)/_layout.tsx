import { DarkTheme, ThemeProvider, usePathname } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform, Text, View } from "react-native";

import { TabTips } from "@/components/tab-tip";
import { copy } from "@/copy";
import { TabHistory, TabPlan, TabWorkouts } from "@/icons";
import { initialIcon, profileLetter } from "@/icons/initial-icon";
import { engine, useEngineStore } from "@/store";
import { PressableScale } from "@/components/pressable-scale";
import { theme } from "@/theme";
import { useReduceMotion } from "@/use-reduce-motion";

const workoutsIcon = require("../../../assets/icons/tab-workouts.png");
const workoutsIconOn = require("../../../assets/icons/tab-workouts-selected.png");
const planIcon = require("../../../assets/icons/tab-plan.png");
const planIconOn = require("../../../assets/icons/tab-plan-selected.png");
const historyIcon = require("../../../assets/icons/tab-history.png");
const historyIconOn = require("../../../assets/icons/tab-history-selected.png");
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

/** PostScript name. UIKit does not see the Expo font key used by React Native text. */
const label = {
  fontFamily: "DMSans-Medium",
  fontSize: 12,
} as const;

const jsLabel = {
  fontFamily: theme.fonts.bodyMedium,
  fontSize: 12,
} as const;

/**
 * iOS 26 draws this bar in Liquid Glass. `backgroundColor` and `blurEffect`
 * only apply on earlier iOS, where the dark material is the translucent bar.
 * SDK 58: import from `expo-router/native-tabs` (`unstable-native-tabs` is a deprecated alias).
 */
function youLabel() {
  return String(engine.wk.name || "").trim() || copy.you.profile;
}

function YouMark({ size }: { size: number }) {
  useEngineStore((state) => state.version);
  const letter = profileLetter(String(engine.wk.name || ""));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ position: "absolute", width: size * 1.6, height: size * 1.6, left: -size * 0.3, top: -size * 0.3, transform: [{ rotate: "-45deg" }] }}>
        {Array.from({ length: 8 }, (_, index) => (
          <View key={index} style={{ flex: 1, backgroundColor: index < 4 ? "#6fd0b4" : "#e9b69b" }} />
        ))}
      </View>
      <Text style={{ fontFamily: theme.fonts.display, fontSize: size * 0.55, color: "#181513", transform: [{ translateY: size * 0.06 }] }}>{letter}</Text>
    </View>
  );
}

function IosTabs() {
  useEngineStore((state) => state.version);
  const path = usePathname();
  const minimize = path === "/plan" || path === "/history" || path === "/you" ? "onScrollDown" : "never";
  const letter = profileLetter(String(engine.wk.name || ""));
  const youIcon = initialIcon(letter);
  const profile = youLabel();
  return (
    <ThemeProvider
      value={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: theme.orange.accent,
          background: theme.orange.background,
          card: theme.orange.surface,
          text: theme.text,
          border: "transparent",
        },
      }}
    >
      <NativeTabs
        iconColor={theme.muted}
        labelStyle={{ default: { ...label, color: theme.muted }, selected: label }}
        blurEffect="systemChromeMaterialDark"
        minimizeBehavior={minimize}
        sidebarAdaptable={false}
      >
        <NativeTabs.Trigger name="index" accessibilityLabel={copy.tabs.workouts} contentStyle={{ backgroundColor: theme.green.background }}>
          <NativeTabs.Trigger.Icon src={{ default: workoutsIcon, selected: workoutsIconOn }} renderingMode="template" selectedColor={theme.green.accent} />
          <NativeTabs.Trigger.Label hidden>{copy.tabs.workouts}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="plan" disableAutomaticContentInsets accessibilityLabel={copy.tabs.plan} contentStyle={{ backgroundColor: theme.orange.background }}>
          <NativeTabs.Trigger.Icon src={{ default: planIcon, selected: planIconOn }} renderingMode="template" selectedColor={theme.orange.accent} />
          <NativeTabs.Trigger.Label hidden>{copy.tabs.plan}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="history" disableAutomaticContentInsets accessibilityLabel={copy.tabs.history} contentStyle={{ backgroundColor: theme.orange.background }}>
          <NativeTabs.Trigger.Icon src={{ default: historyIcon, selected: historyIconOn }} renderingMode="template" selectedColor={theme.orange.accent} />
          <NativeTabs.Trigger.Label hidden>{copy.tabs.history}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="you" disableAutomaticContentInsets accessibilityLabel={profile} contentStyle={{ backgroundColor: theme.pink.background }}>
          <NativeTabs.Trigger.Icon src={youIcon} renderingMode="original" />
          <NativeTabs.Trigger.Label hidden>{profile}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}

function JsTabs() {
  const reduceMotion = useReduceMotion();
  useEngineStore((state) => state.version);
  const profile = youLabel();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? "fade" : "shift",
        tabBarInactiveTintColor: theme.muted,
        tabBarActiveTintColor: theme.orange.accent,
        tabBarStyle: bar(theme.orange.background),
        tabBarShowLabel: false,
        tabBarLabelStyle: jsLabel,
        tabBarButton: (props) => {
          const { ref: _ref, ...rest } = props;
          return <PressableScale kind="tab" {...rest} />;
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: copy.tabs.workouts,
          tabBarAccessibilityLabel: copy.tabs.workouts,
          tabBarIcon: ({ color, focused }) => <TabWorkouts size={26} color={tint(color)} strokeWidth={focused ? 2.6 : 1.8} />,
          tabBarActiveTintColor: theme.green.accent,
          tabBarStyle: bar(theme.green.background),
          sceneStyle: { backgroundColor: theme.green.background },
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: copy.tabs.plan,
          tabBarAccessibilityLabel: copy.tabs.plan,
          tabBarIcon: ({ color, focused }) => <TabPlan size={26} color={tint(color)} strokeWidth={focused ? 2.6 : 1.8} />,
          sceneStyle: { backgroundColor: theme.orange.background },
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: copy.tabs.history,
          tabBarAccessibilityLabel: copy.tabs.history,
          tabBarIcon: ({ color, focused }) => <TabHistory size={26} color={tint(color)} strokeWidth={focused ? 2.6 : 1.8} />,
          sceneStyle: { backgroundColor: theme.orange.background },
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: profile,
          tabBarAccessibilityLabel: profile,
          tabBarIcon: () => <YouMark size={30} />,
          tabBarActiveTintColor: theme.pink.accent,
          tabBarStyle: bar(theme.pink.background),
          sceneStyle: { backgroundColor: theme.pink.background },
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      {Platform.OS === "ios" ? <IosTabs /> : <JsTabs />}
      <TabTips />
    </View>
  );
}
