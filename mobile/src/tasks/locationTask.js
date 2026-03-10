import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const LOCATION_TASK = "home-hub-location";
export const CLOUD_BASE = "https://mytracking.com.ua/api";

async function sendLocation(location) {
  try {
    const raw = await AsyncStorage.getItem("auth");
    if (!raw) return;
    const { token } = JSON.parse(raw);
    if (!token) return;

    const { latitude, longitude, speed, accuracy } = location.coords;
    await fetch(`${CLOUD_BASE}/logs/phone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ latitude, longitude, speed, accuracy }),
    });
  } catch (err) {
    console.error("[LocationTask] send error:", err.message);
  }
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("[LocationTask] error:", error.message);
    return;
  }
  if (data?.locations?.length) {
    await sendLocation(data.locations[0]);
  }
});

export async function startLocationTracking() {
  // Крок 1: foreground дозвіл (показує системний діалог)
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") throw new Error("Дозвольте доступ до геолокації");

  // Крок 2: background дозвіл (показує системний діалог з вибором "Завжди")
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== "granted") throw new Error("Оберіть 'Дозволити завжди' для фонового трекінгу");

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000,      // не частіше 1 разу на хвилину
      distanceInterval: 50,     // або при переміщенні на 50 м
      foregroundService: {
        notificationTitle: "Home Hub",
        notificationBody: "GPS трекінг активний",
        notificationColor: "#3b82f6",
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
  }
}

export async function stopLocationTracking() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
