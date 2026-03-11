import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, TextInput, Alert, ActivityIndicator,
} from "react-native";
import * as TaskManager from "expo-task-manager";
import { LOCATION_TASK } from "../../src/tasks/locationTask";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useSettingsStore } from "../../src/store/useSettingsStore";
import { api } from "../../src/services/api";
import DebugPanel from "../../src/components/DebugPanel";

const FEATURES = [
  { key: "tracking", label: "🗺️ Трекінг", desc: "GPS трекінг трекерів" },
  { key: "ha",       label: "🏡 Дім",      desc: "Home Assistant інтеграція" },
  { key: "kanban",   label: "📋 Канбан",   desc: "Дошка задач" },
  { key: "chat",     label: "💬 Чат",      desc: "Сімейний чат" },
  { key: "photos",   label: "🖼️ Фото",     desc: "Immich — фотогалерея" },
  { key: "files",    label: "📁 Файли",    desc: "Filebrowser — файловий менеджер" },
];

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { localUrl, features, localOnline, phoneTracking, setLocalUrl, toggleFeature, setPhoneTracking, checkLocalServer } = useSettingsStore();
  const [urlInput, setUrlInput] = useState(localUrl);

  const [curPass,  setCurPass]  = useState("");
  const [newPass,  setNewPass]  = useState("");
  const [confPass, setConfPass] = useState("");
  const [passMsg,  setPassMsg]  = useState(null); // { ok, text }
  const [passSaving, setPassSaving] = useState(false);

  async function handleChangePassword() {
    if (!curPass || !newPass || !confPass) {
      setPassMsg({ ok: false, text: "Заповніть всі поля" }); return;
    }
    if (newPass !== confPass) {
      setPassMsg({ ok: false, text: "Паролі не збігаються" }); return;
    }
    if (newPass.length < 6) {
      setPassMsg({ ok: false, text: "Мінімум 6 символів" }); return;
    }
    setPassSaving(true);
    setPassMsg(null);
    try {
      await api.changePassword(curPass, newPass);
      setPassMsg({ ok: true, text: "Пароль змінено ✓" });
      setCurPass(""); setNewPass(""); setConfPass("");
    } catch (err) {
      setPassMsg({ ok: false, text: err.message });
    } finally {
      setPassSaving(false);
    }
  }

  async function handlePhoneTracking(val) {
    try {
      await setPhoneTracking(val);
    } catch (err) {
      Alert.alert("Помилка", err.message || "Не вдалося увімкнути трекінг");
    }
  }

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
    setTimeout(() => checkLocalServer(), 300);
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

        {/* Зміна пароля */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🔑 Змінити пароль</Text>
          <TextInput
            style={s.input}
            value={curPass}
            onChangeText={setCurPass}
            placeholder="Поточний пароль"
            placeholderTextColor="#6b7280"
            secureTextEntry
          />
          <TextInput
            style={s.input}
            value={newPass}
            onChangeText={setNewPass}
            placeholder="Новий пароль (мін. 6 символів)"
            placeholderTextColor="#6b7280"
            secureTextEntry
          />
          <TextInput
            style={s.input}
            value={confPass}
            onChangeText={setConfPass}
            placeholder="Повторіть новий пароль"
            placeholderTextColor="#6b7280"
            secureTextEntry
          />
          {passMsg && (
            <Text style={{ color: passMsg.ok ? "#22c55e" : "#f87171", fontSize: 13 }}>
              {passMsg.text}
            </Text>
          )}
          <TouchableOpacity
            style={[s.saveBtn, { borderRadius: 12, padding: 14, alignItems: "center" }]}
            onPress={handleChangePassword}
            disabled={passSaving}
          >
            {passSaving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: "#fff", fontWeight: "600" }}>Змінити пароль</Text>}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <View style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: localOnline === null ? "#6b7280" : localOnline ? "#22c55e" : "#f87171",
            }} />
            <Text style={s.currentUrl}>
              {localOnline === null ? "Перевірка..." : localOnline ? "Сервер доступний" : "Сервер недоступний"} · {localUrl}
            </Text>
          </View>
        </View>

        {/* GPS трекінг телефону */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>📍 GPS трекінг телефону</Text>
          <Text style={s.hint}>Телефон надсилає координати на сервер раз на хвилину</Text>
          <View style={s.featureRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.featureLabel}>Фоновий трекінг</Text>
              <Text style={s.featureDesc}>
                {phoneTracking ? "✅ Активний — видно на карті як 📱 Телефон" : "Вимкнено"}
              </Text>
            </View>
            <Switch
              value={phoneTracking}
              onValueChange={handlePhoneTracking}
              trackColor={{ false: "#4b5563", true: "#1d4ed8" }}
              thumbColor="#fff"
            />
          </View>
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
