import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useSettingsStore } from "../../src/store/useSettingsStore";
import DebugPanel from "../../src/components/DebugPanel";

const FEATURES = [
  { key: "tracking", label: "🗺️ Трекінг", desc: "GPS трекінг трекерів" },
  { key: "ha",       label: "🏡 Дім",      desc: "Home Assistant інтеграція" },
  { key: "kanban",   label: "📋 Канбан",   desc: "Дошка задач" },
];

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { localUrl, features, setLocalUrl, toggleFeature } = useSettingsStore();
  const [urlInput, setUrlInput] = useState(localUrl);

  async function handleLogout() {
    Alert.alert("Вийти", "Ви впевнені?", [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Вийти",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  function saveUrl() {
    const url = urlInput.trim().replace(/\/$/, "");
    setLocalUrl(url);
    setUrlInput(url);
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>⚙️ Налаштування</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Акаунт */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Акаунт</Text>
          <View style={s.card}>
            <Text style={s.cardLabel}>Email</Text>
            <Text style={s.cardValue}>{user?.email || "—"}</Text>
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutText}>Вийти з акаунту</Text>
          </TouchableOpacity>
        </View>

        {/* Локальний сервер */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Локальний сервер</Text>
          <Text style={s.hint}>Адреса вашого домашнього сервера в Wi-Fi мережі</Text>
          <View style={s.urlRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="http://192.168.1.34"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity style={s.saveBtn} onPress={saveUrl}>
              <Text style={{ color: "#fff", fontWeight: "600" }}>OK</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.currentUrl}>Поточна: {localUrl}</Text>
        </View>

        {/* Функції */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Функції</Text>
          <Text style={s.hint}>Вмикайте тільки ті вкладки які вам потрібні</Text>
          {FEATURES.map((f) => (
            <View key={f.key} style={s.featureRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.featureLabel}>{f.label}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
              <Switch
                value={features[f.key]}
                onValueChange={() => toggleFeature(f.key)}
                trackColor={{ false: "#4b5563", true: "#1d4ed8" }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        {/* Debug */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🐛 Дебаг</Text>
          <Text style={s.hint}>Логи для діагностики проблем</Text>
        </View>
      </ScrollView>

      <DebugPanel />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#374151" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  section: { gap: 8 },
  sectionTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  hint: { color: "#6b7280", fontSize: 12 },
  card: { backgroundColor: "#1f2937", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#374151" },
  cardLabel: { color: "#6b7280", fontSize: 11 },
  cardValue: { color: "#fff", fontSize: 15, fontWeight: "500", marginTop: 2 },
  logoutBtn: { backgroundColor: "#1f2937", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#7f1d1d" },
  logoutText: { color: "#f87171", fontWeight: "600" },
  input: { backgroundColor: "#1f2937", color: "#fff", borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1, borderColor: "#374151" },
  urlRow: { flexDirection: "row", gap: 8 },
  saveBtn: { backgroundColor: "#3b82f6", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  currentUrl: { color: "#6b7280", fontSize: 11 },
  featureRow: { backgroundColor: "#1f2937", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#374151" },
  featureLabel: { color: "#fff", fontSize: 14, fontWeight: "500" },
  featureDesc: { color: "#6b7280", fontSize: 12, marginTop: 2 },
});
