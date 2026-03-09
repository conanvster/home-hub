import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from "react-native";
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

function TrackerCard({ tracker, latest }) {
  const log = latest?.[tracker._id] || latest?.[tracker.imei];
  const isOnline = log && (Date.now() - new Date(log.timestamp).getTime()) < 5 * 60000;

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={[s.dot, { backgroundColor: isOnline ? "#22c55e" : "#6b7280" }]} />
        <Text style={s.trackerName}>{tracker.name || tracker.imei}</Text>
        <Text style={s.age}>{log ? formatAge(log.timestamp) : "немає даних"}</Text>
      </View>
      {log && (
        <View style={s.cardBody}>
          <Text style={s.coord}>
            {parseFloat(log.lat).toFixed(5)}, {parseFloat(log.lon).toFixed(5)}
          </Text>
          <Text style={s.time}>{formatTime(log.timestamp)}</Text>
          {log.speed != null && (
            <Text style={s.speed}>{Math.round(log.speed)} км/год</Text>
          )}
        </View>
      )}
    </View>
  );
}

export default function TrackingScreen() {
  const [trackers, setTrackers] = useState([]);
  const [latest, setLatest] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [t, l] = await Promise.all([api.getTrackers(), api.getLatest()]);
      setTrackers(t);
      // latest повертає масив або об'єкт
      const map = {};
      if (Array.isArray(l)) l.forEach((x) => { map[x.tracker] = x; });
      else Object.assign(map, l);
      setLatest(map);
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
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>🗺️ Трекінг</Text>
      </View>

      {error && <Text style={s.error}>{error}</Text>}

      <FlatList
        data={trackers}
        keyExtractor={(t) => t._id}
        renderItem={({ item }) => <TrackerCard tracker={item} latest={latest} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />}
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
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#374151" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  card: { backgroundColor: "#1f2937", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#374151" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  trackerName: { flex: 1, color: "#fff", fontWeight: "600", fontSize: 15 },
  age: { color: "#6b7280", fontSize: 12 },
  cardBody: { marginTop: 10, gap: 4 },
  coord: { color: "#9ca3af", fontSize: 13, fontFamily: "monospace" },
  time: { color: "#6b7280", fontSize: 12 },
  speed: { color: "#3b82f6", fontSize: 13, fontWeight: "600" },
  error: { color: "#f87171", padding: 16, fontSize: 13 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 40, fontSize: 14 },
});
