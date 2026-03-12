import { Redirect, withLayoutContext } from "expo-router";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useSettingsStore } from "../../src/store/useSettingsStore";
import { SafeAreaView } from "react-native-safe-area-context";
import { fs } from "../../src/utils/font";

const { Navigator } = createMaterialTopTabNavigator();
const TopTabs = withLayoutContext(Navigator);

export default function TabsLayout() {
  const token = useAuthStore((s) => s.token);
  const features = useSettingsStore((s) => s.features);
  const localOnline = useSettingsStore((s) => s.localOnline);
  const fontScale = useSettingsStore((s) => s.fontScale);

  if (!token) return <Redirect href="/(auth)/login" />;

  // Локальні таби — тільки коли локальний сервер онлайн
  const local = (feat) => feat && localOnline === true ? undefined : null;

  // Хмарні таби — тільки якщо функцію ввімкнено (незалежно від локального)
  const cloud = (feat) => feat ? undefined : null;

  const labelStyle = { fontSize: fs(11, fontScale), fontWeight: "600", textTransform: "none" };

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
          tabBarLabelStyle: labelStyle,
          tabBarPressColor: "#374151",
          tabBarScrollEnabled: true,
          swipeEnabled: true,
        }}
      >
        {/* 1. Трекінг — хмара, завжди */}
        <TopTabs.Screen
          name="tracking"
          options={{ title: "🗺️ Трекінг", href: cloud(features.tracking) }}
        />

        {/* 2. Канбан — хмара, завжди */}
        <TopTabs.Screen
          name="kanban"
          options={{ title: "📋 Канбан", href: cloud(features.kanban) }}
        />

        {/* 3. Чат — хмара, завжди */}
        <TopTabs.Screen
          name="chat"
          options={{ title: "💬 Чат", href: cloud(features.chat) }}
        />

        {/* 4. Дім — локально */}
        <TopTabs.Screen
          name="ha"
          options={{ title: "🏡 Дім", href: local(features.ha) }}
        />

        {/* 5. Фото — локально */}
        <TopTabs.Screen
          name="photos"
          options={{ title: "🖼️ Фото", href: local(features.photos) }}
        />

        {/* 6. Файли — локально */}
        <TopTabs.Screen
          name="files"
          options={{ title: "📁 Файли", href: local(features.files) }}
        />

        {/* 7. Налаштування — завжди */}
        <TopTabs.Screen
          name="settings"
          options={{ title: "⚙️ Налаштування" }}
        />
      </TopTabs>
    </SafeAreaView>
  );
}
