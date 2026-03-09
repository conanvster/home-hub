import { Tabs, Redirect } from "expo-router";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useSettingsStore } from "../../src/store/useSettingsStore";
import { Text } from "react-native";

function TabIcon({ icon, focused }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>;
}

export default function TabsLayout() {
  const token = useAuthStore((s) => s.token);
  const features = useSettingsStore((s) => s.features);

  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1f2937",
          borderTopColor: "#374151",
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#6b7280",
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="tracking"
        options={{
          title: "Трекінг",
          tabBarIcon: ({ focused }) => <TabIcon icon="🗺️" focused={focused} />,
          href: features.tracking ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="ha"
        options={{
          title: "Дім",
          tabBarIcon: ({ focused }) => <TabIcon icon="🏡" focused={focused} />,
          href: features.ha ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="kanban"
        options={{
          title: "Канбан",
          tabBarIcon: ({ focused }) => <TabIcon icon="📋" focused={focused} />,
          href: features.kanban ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Налаштування",
          tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
