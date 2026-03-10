import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { CLOUD_BASE } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Показувати нотифікації навіть коли app відкритий
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushToken() {
  try {
    // Запит дозволу
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    // Отримати токен (тільки для EAS builds з projectId)
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: "f635aa99-530a-405c-8ef5-36828b923109",
    });

    if (!token) return;

    // Зберегти на сервері
    const raw = await AsyncStorage.getItem("auth");
    if (!raw) return;
    const { token: jwt } = JSON.parse(raw);
    if (!jwt) return;

    await fetch(`${CLOUD_BASE}/auth/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ token }),
    });

    console.log("Push token registered:", token.slice(0, 30) + "...");
  } catch (err) {
    console.error("Push token registration failed:", err.message);
  }
}
