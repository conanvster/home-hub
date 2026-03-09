import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/useAuthStore";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#111827" }}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  return <Redirect href={token ? "/(tabs)/tracking" : "/(auth)/login"} />;
}
