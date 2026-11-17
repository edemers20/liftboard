import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";

import { scrubEvent } from "./scrub";

/** Integrations that record what the person did or saw (taps, screens, routes, logs, network, screenshots). */
const LEAVE_OUT = new Set([
  "Breadcrumbs",
  "ExpoRouter",
  "NavigationContainer",
  "DeepLink",
  "UserInteraction",
  "HttpClient",
  "Screenshot",
  "ViewHierarchy",
  "MobileReplay",
  "ConsoleLogs",
  "LogEnricher",
  "ExpoConstants",
]);

/**
 * Crash reports for TestFlight and release builds. Off unless `EXPO_PUBLIC_SENTRY_DSN` is set for the build
 * (an EAS environment variable; see docs/RELEASE-IOS.md). Every event goes through `scrubEvent`.
 */
export function startCrashReports() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || __DEV__ || Platform.OS === "web") return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: () => null,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    reportAccessibilityIdentifier: false,
    enableCaptureFailedRequests: false,
    enableUserInteractionTracing: false,
    enableAutoPerformanceTracing: false,
    integrations: (defaults) => defaults.filter((integration) => !LEAVE_OUT.has(integration.name)),
  });
}
