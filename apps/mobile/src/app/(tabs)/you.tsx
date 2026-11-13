import { useRouter } from "expo-router";

import { YouTab } from "@/components/you-tab";

export default function YouScreen() {
  const router = useRouter();
  return <YouTab onReplay={() => router.push("/onboarding")} />;
}
