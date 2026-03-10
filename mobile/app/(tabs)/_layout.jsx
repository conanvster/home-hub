import { Redirect, withLayoutContext } from "expo-router";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useSettingsStore } from "../../src/store/useSettingsStore";
import { SafeAreaView } from "react-native-safe-area-context";

const { Navigator } = createMaterialTopTabNavigator();
const TopTabs = withLayoutContext(Navigator);

export default function TabsLayout() {
  const token = useAuthStore((s) => s.token);
  const features = useSettingsStore((s) => s.features);
  const localOnline = useSettingsStore((s) => s.localOnline);

  if (!token) return <Redirect href="/(auth)/login" />;

  // Локальні таби доступні лише коли сервер онлайн
  const local = (feat) => feat && localOnline === true ? undefined : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111827" }} edges={["top"]}>
      <TopTabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: "#1f2937",
            borderBottomWidth: 1,
            borderBottomColor: "#374151",
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarIndicatorStyle: {
            backgroundColor: "#3b82f6",
            height: 2,
          },
          tabBarActiveTintColor: "#3b82f6",
          tabBarInactiveTintColor: "#6b7280",
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600", textTransform: "none" },
          tabBarPressColor: "#374151",
          tabBarScrollEnabled: true,
          swipeEnabled: true,
        }}
      >
        {/* Трекінг — завжди (хмара) */}
        <TopTabs.Screen
          name="tracking"
          options={{
            title: "🗺️ Трекінг",
            href: features.tracking ? undefined : null,
          }}
        />

        {/* Локальні таби — тільки якщо локальний сервер доступний */}
        <TopTabs.Screen
          name="ha"
          options={{ title: "🏡 Дім", href: local(features.ha) }}
        />
        <TopTabs.Screen
          name="kanban"
          options={{ title: "📋 Канбан", href: local(features.kanban) }}
        />
        <TopTabs.Screen
          name="photos"
          options={{ title: "🖼️ Фото", href: local(features.photos) }}
        />
        <TopTabs.Screen
          name="files"
          options={{ title: "📁 Файли", href: local(features.files) }}
        />

        {/* Чат — завжди (перемикається між local/cloud у середині) */}
        <TopTabs.Screen
          name="chat"
          options={{ title: "💬 Чат" }}
        />

        {/* Налаштування — завжди */}
        <TopTabs.Screen
          name="settings"
          options={{ title: "⚙️ Налаштування" }}
        />
      </TopTabs>
    </SafeAreaView>
  );
}
