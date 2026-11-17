import type { LiveActivityFactory } from "expo-widgets";

import type { WorkoutActivityProps } from "./state";

/** Live Activities are iOS only (`workout-activity.ios.tsx`). */
export const WorkoutActivity: LiveActivityFactory<WorkoutActivityProps> | null = null;
