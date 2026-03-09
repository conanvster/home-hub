import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../src/store/useAuthStore";
import { useSettingsStore } from "../src/store/useSettingsStore";

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  const initSettings = useSettingsStore((s) => s.init);

  useEffect(() => {
    init();
    initSettings();
    console.log("App started");
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
