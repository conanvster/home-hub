import { Redirect, withLayoutContext } from "expo-router";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useSettingsStore } from "../../src/store/useSettingsStore";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { Navigator } = createMaterialTopTabNavigator();
const TopTabs = withLayoutContext(Navigator);

function TabLabel({ icon, label, focused }) {
  return (
    <Text style={{ fontSize: 11, color: focused ? "#3b82f6" : "#6b7280", marginTop: 2 }}>
      {icon} {label}
    </Text>
  );
}

export default function TabsLayout() {
  const token = useAuthStore((s) => s.token);
  const features = useSettingsStore((s) => s.features);

  if (!token) return <Redirect href="/(auth)/login" />;

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
          swipeEnabled: true,
        }}
      >
        <TopTabs.Screen
          name="tracking"
          options={{
            title: "🗺️ Трекінг",
            href: features.tracking ? undefined : null,
          }}
        />
        <TopTabs.Screen
          name="ha"
          options={{
            title: "🏡 Дім",
            href: features.ha ? undefined : null,
          }}
        />
        <TopTabs.Screen
          name="kanban"
          options={{
            title: "📋 Канбан",
            href: features.kanban ? undefined : null,
          }}
        />
        <TopTabs.Screen
          name="chat"
          options={{
            title: "💬 Чат",
            href: features.chat ? undefined : null,
          }}
        />
        <TopTabs.Screen
          name="photos"
          options={{
            title: "🖼️ Фото",
            href: features.photos ? undefined : null,
          }}
        />
        <TopTabs.Screen
          name="files"
          options={{
            title: "📁 Файли",
            href: features.files ? undefined : null,
          }}
        />
        <TopTabs.Screen
          name="settings"
          options={{ title: "⚙️ Налаштування" }}
        />
      </TopTabs>
    </SafeAreaView>
  );
}
