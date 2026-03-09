import { useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useSettingsStore } from "../../src/store/useSettingsStore";

export default function FilesScreen() {
  const localUrl = useSettingsStore((s) => s.localUrl);
  const localOnline = useSettingsStore((s) => s.localOnline);
  const filebrowserUrl = `${localUrl}:8080`;

  const webRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (localOnline === false) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>📁 Файли</Text>
        </View>
        <View style={s.center}>
          <Text style={s.offlineText}>📡 Локальний сервер недоступний</Text>
          <Text style={s.offlineHint}>Файли доступні тільки в домашній мережі</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>📁 Файли</Text>
        <TouchableOpacity onPress={() => { setError(false); setLoading(true); webRef.current?.reload(); }}>
          <Text style={s.reload}>↺</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={s.center}>
          <Text style={s.offlineText}>❌ Не вдалося завантажити Filebrowser</Text>
          <Text style={s.offlineHint}>{filebrowserUrl}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setError(false); setLoading(true); webRef.current?.reload(); }}>
            <Text style={{ color: "#fff" }}>Спробувати ще раз</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {loading && (
            <View style={s.loadingOverlay}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={s.loadingText}>Завантаження Filebrowser...</Text>
            </View>
          )}
          <WebView
            ref={webRef}
            source={{ uri: filebrowserUrl }}
            style={{ flex: 1, opacity: loading ? 0 : 1 }}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            onHttpError={() => { setLoading(false); setError(true); }}
            javaScriptEnabled
            domStorageEnabled
          />
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#374151" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  reload: { color: "#3b82f6", fontSize: 22, fontWeight: "300" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, padding: 24 },
  offlineText: { color: "#f59e0b", fontSize: 15, fontWeight: "600" },
  offlineHint: { color: "#6b7280", fontSize: 12 },
  loadingOverlay: { position: "absolute", top: 60, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 10, gap: 12 },
  loadingText: { color: "#6b7280", fontSize: 13 },
  retryBtn: { marginTop: 8, backgroundColor: "#3b82f6", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
});
