import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/services/api";

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("uk-UA", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatAge(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "< 1 хв";
  if (m < 60) return `${m} хв тому`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} год тому`;
  return `${Math.floor(h / 24)} дн тому`;
}

function TrackerCard({ item }) {
  const { tracker, log } = item;
  const isOnline = log?.deviceTime &&
    (Date.now() - new Date(log.deviceTime).getTime()) < 5 * 60000;

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={[s.dot, { backgroundColor: isOnline ? "#22c55e" : "#6b7280" }]} />
        <Text style={s.trackerName}>{tracker.name || tracker.imei}</Text>
        <Text style={s.age}>{log ? formatAge(log.deviceTime) : "немає даних"}</Text>
      </View>
      {log ? (
        <View style={s.cardBody}>
          <Text style={s.coord}>
            {parseFloat(log.lat).toFixed(5)}, {parseFloat(log.lon).toFixed(5)}
          </Text>
          <Text style={s.time}>{formatTime(log.deviceTime)}</Text>
          {log.speed != null && (
            <Text style={s.speed}>{Math.round(log.speed)} км/год</Text>
          )}
        </View>
      ) : (
        <Text style={s.noData}>Позиція невідома</Text>
      )}
    </View>
  );
}

export default function TrackingScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      // getLatest повертає [{tracker, log}] — один запит замість двох
      const data = await api.getLatest();
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      {error && <Text style={s.error}>❌ {error}</Text>}

      <FlatList
        data={items}
        keyExtractor={(item) => item.tracker._id}
        renderItem={({ item }) => <TrackerCard item={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#3b82f6"
          />
        }
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          !loading && <Text style={s.empty}>Немає трекерів</Text>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  card: { backgroundColor: "#1f2937", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#374151" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  trackerName: { flex: 1, color: "#fff", fontWeight: "600", fontSize: 15 },
  age: { color: "#6b7280", fontSize: 12 },
  cardBody: { marginTop: 10, gap: 4 },
  coord: { color: "#9ca3af", fontSize: 13, fontFamily: "monospace" },
  time: { color: "#6b7280", fontSize: 12 },
  speed: { color: "#3b82f6", fontSize: 13, fontWeight: "600" },
  noData: { color: "#6b7280", fontSize: 13, marginTop: 8 },
  error: { color: "#f87171", padding: 16, fontSize: 13 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 40, fontSize: 14 },
});
