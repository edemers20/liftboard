import { Platform } from "react-native";

/** Keeps a native view alive for capture and measuring. react-native-web passes the prop to the DOM and warns. */
export const noCollapse = Platform.OS === "web" ? {} : ({ collapsable: false } as const);
