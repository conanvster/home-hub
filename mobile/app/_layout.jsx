import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../src/store/useAuthStore";
import { useSettingsStore } from "../src/store/useSettingsStore";
// Визначення фонової задачі — має бути імпортовано до рендеру
import "../src/tasks/locationTask";
import { registerPushToken } from "../src/services/notifications";

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  const initSettings = useSettingsStore((s) => s.init);
  const checkLocalServer = useSettingsStore((s) => s.checkLocalServer);

  useEffect(() => {
    init();
    initSettings().then(() => {
      checkLocalServer();
    });
    registerPushToken();
    console.log("App started");

    // Перевірка кожні 30 секунд
    const interval = setInterval(() => {
      checkLocalServer();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
