import { DMMono_400Regular } from "@expo-google-fonts/dm-mono/400Regular";
import { DMMono_500Medium } from "@expo-google-fonts/dm-mono/500Medium";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_600SemiBold } from "@expo-google-fonts/dm-sans/600SemiBold";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { Ranchers_400Regular } from "@expo-google-fonts/ranchers/400Regular";
import { useFonts } from "expo-font";
import { Redirect, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, Platform, View } from "react-native";
import { SharedTransitionBoundary } from "react-native-reanimated";

import { LaunchSplash, claimLaunchSplash } from "@/components/launch-splash";
import { LiveWorkoutState, useLiveWorkout } from "@/components/live-workout";
import { DialHost } from "@/components/number-dial";
import { NoticeHost } from "@/components/motion";
import { TipHost } from "@/components/tip-popover";
import { engine, useEngineStore } from "@/store";
import { watchTabTipPath } from "@/tab-tips";
import { WeekReportHost } from "@/week-report";
import { theme } from "@/theme";
import { useReduceMotion } from "@/use-reduce-motion";
import { prepareRestAlerts } from "@/workout/notify";
import { subscribeWorkoutEnter, WORKOUT_CLOSE_MS, type WorkoutEnter } from "@/workout/share-box";
import { rollWeekIfDue } from "@/week-roll";

SplashScreen.preventAutoHideAsync();

/** Read once at launch. Finishing navigates away; the next launch reads the saved flag. */
export const unstable_settings = {
  anchor: engine.wk.onbDone ? "(tabs)" : "onboarding",
};

/** The web build's boundary is an empty object, which crashes the tree. The phone keeps the card move. */
function TransitionRoot({ active, children }: { active: boolean; children: ReactNode }) {
  if (Platform.OS === "web") return children;
  return <SharedTransitionBoundary isActive={active}>{children}</SharedTransitionBoundary>;
}

function OnboardingGate() {
  const pathname = usePathname();
  useEngineStore((state) => state.version);
  useEffect(() => {
    if (pathname) watchTabTipPath(pathname);
  }, [pathname]);
  if (engine.wk.onbDone) return null;
  if (!pathname || pathname === "/onboarding") return null;
  return <Redirect href="/onboarding" />;
}

export default function RootLayout() {
  const [ready, error] = useFonts({
    Ranchers_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });
  const appReady = ready || !!error;
  const [showSplash, setShowSplash] = useState(claimLaunchSplash);

  useEffect(() => {
    if (!showSplash && appReady) SplashScreen.hideAsync().catch(() => {});
  }, [showSplash, appReady]);

  useEffect(() => {
    prepareRestAlerts();
    rollWeekIfDue();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") rollWeekIfDue();
    });
    return () => sub.remove();
  }, []);

  const reduceMotion = useReduceMotion();
  const [enter, setEnter] = useState<WorkoutEnter>("plain");
  useEffect(() => subscribeWorkoutEnter(setEnter), []);
  const live = useLiveWorkout();

  return (
    <LiveWorkoutState live={live}>
    <View style={{ flex: 1, backgroundColor: theme.orange.background }}>
      <StatusBar style="light" />
      {appReady ? (
        <>
          <OnboardingGate />
          <TransitionRoot active={!reduceMotion}>
        <DialHost>
        <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.green.background },
          }}
        >
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: "fade", contentStyle: { backgroundColor: theme.orange.background } }} />
          <Stack.Screen name="settings" options={{ contentStyle: { backgroundColor: theme.pink.background } }} />
          <Stack.Screen
            name="workout/[id]"
            options={{
              animation: reduceMotion ? "fade" : Platform.OS === "ios" ? "default" : enter === "expand" ? "none" : "fade",
              animationDuration: reduceMotion ? 140 : WORKOUT_CLOSE_MS,
            }}
          />
          <Stack.Screen
            name="activity/[t]"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.68, 1],
              sheetGrabberVisible: true,
              sheetInitialDetentIndex: 0,
              headerShown: false,
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
          <Stack.Screen
            name="sheet-fit"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: "fitToContents",
              sheetGrabberVisible: true,
              headerShown: false,
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
          <Stack.Screen
            name="sheet-report"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [1],
              sheetGrabberVisible: true,
              sheetExpandsWhenScrolledToEdge: false,
              headerShown: false,
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
        </Stack>
        <NoticeHost />
        <TipHost />
        </View>
        <WeekReportHost />
        </DialHost>
          </TransitionRoot>
        </>
      ) : null}
      {showSplash ? <LaunchSplash appReady={appReady} onDone={() => setShowSplash(false)} /> : null}
    </View>
    </LiveWorkoutState>
  );
}
