import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Modal, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { api } from "../../src/services/api";

// ── Утиліти ───────────────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("uk-UA", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatAge(iso) {
  if (!iso) return "немає даних";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "< 1 хв тому";
  if (m < 60) return `${m} хв тому`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} год тому`;
  return `${Math.floor(h / 24)} дн тому`;
}

// ── Карта з маршрутом ─────────────────────────────────────────
const PERIODS = [
  { label: "1 год",  hours: 1 },
  { label: "6 год",  hours: 6 },
  { label: "24 год", hours: 24 },
  { label: "7 дн",   hours: 168 },
];

function TrackerMapModal({ tracker, latestLog, onClose }) {
  const [period, setPeriod] = useState(PERIODS[1]);
  const [route, setRoute] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const loadRoute = useCallback(async () => {
    if (!tracker?.imei) return;
    setLoadingRoute(true);
    try {
      const from = new Date(Date.now() - period.hours * 3600000).toISOString();
      const logs = await api.getLogs(tracker.imei, from);
      const coords = logs
        .filter((l) => l.latitude != null && l.longitude != null)
        .map((l) => ({ latitude: l.latitude, longitude: l.longitude }))
        .reverse(); // oldest first for polyline
      setRoute(coords);
    } catch {}
    setLoadingRoute(false);
  }, [tracker?.imei, period]);

  useEffect(() => { loadRoute(); }, [loadRoute]);

  const hasPosition = latestLog?.latitude != null && latestLog?.longitude != null;
  const region = hasPosition ? {
    latitude: latestLog.latitude,
    longitude: latestLog.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  } : {
    latitude: 48.5, longitude: 32.0,
    latitudeDelta: 5, longitudeDelta: 5,
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#111827" }}>
        {/* Header */}
        <View style={ms.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={ms.close}>✕</Text>
          </TouchableOpacity>
          <Text style={ms.title}>{tracker.name || tracker.imei}</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Period selector */}
        <View style={ms.periods}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.label}
              style={[ms.periodBtn, period.label === p.label && ms.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[ms.periodText, period.label === p.label && ms.periodTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
          {loadingRoute && <ActivityIndicator size="small" color="#3b82f6" style={{ marginLeft: 8 }} />}
        </View>

        {/* Map */}
        <MapView
          style={{ flex: 1 }}
          provider={PROVIDER_DEFAULT}
          initialRegion={region}
          showsUserLocation
        >
          {/* Маршрут */}
          {route.length > 1 && (
            <Polyline
              coordinates={route}
              strokeColor="#3b82f6"
              strokeWidth={3}
            />
          )}
          {/* Початок маршруту */}
          {route.length > 0 && (
            <Marker coordinate={route[0]} title="Початок">
              <View style={ms.dotStart} />
            </Marker>
          )}
          {/* Поточна позиція */}
          {hasPosition && (
            <Marker
              coordinate={{ latitude: latestLog.latitude, longitude: latestLog.longitude }}
              title={tracker.name || tracker.imei}
              description={formatTime(latestLog.deviceTime)}
            >
              <View style={ms.dotCurrent} />
            </Marker>
          )}
        </MapView>

        {/* Info bar */}
        {latestLog && (
          <View style={ms.infoBar}>
            <Text style={ms.infoText}>
              📍 {latestLog.latitude?.toFixed(5)}, {latestLog.longitude?.toFixed(5)}
            </Text>
            <Text style={ms.infoText}>
              🕐 {formatTime(latestLog.deviceTime)}
              {latestLog.speed != null ? `  · ${Math.round(latestLog.speed)} км/год` : ""}
            </Text>
            {route.length > 0 && (
              <Text style={ms.infoText}>📏 Точок маршруту: {route.length}</Text>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── Картка трекера ────────────────────────────────────────────
function TrackerCard({ item, onPress }) {
  const { tracker, log } = item;
  const isOnline = log?.deviceTime &&
    (Date.now() - new Date(log.deviceTime).getTime()) < 5 * 60000;

  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(item)} activeOpacity={0.7}>
      <View style={s.cardHeader}>
        <View style={[s.dot, { backgroundColor: isOnline ? "#22c55e" : "#6b7280" }]} />
        <Text style={s.trackerName}>{tracker.name || tracker.imei}</Text>
        <Text style={s.chevron}>›</Text>
      </View>
      <View style={s.cardBody}>
        {log ? (
          <>
            <Text style={s.age}>{formatAge(log.deviceTime)}</Text>
            {log.latitude != null && (
              <Text style={s.coord}>
                {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
              </Text>
            )}
            <View style={s.row}>
              <Text style={s.time}>{formatTime(log.deviceTime)}</Text>
              {log.speed != null && (
                <Text style={s.speed}>{Math.round(log.speed)} км/год</Text>
              )}
            </View>
          </>
        ) : (
          <Text style={s.noData}>Позиція невідома</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Головний екран ────────────────────────────────────────────
export default function TrackingScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
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
        renderItem={({ item }) => <TrackerCard item={item} onPress={setSelected} />}
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

      {selected && (
        <TrackerMapModal
          tracker={selected.tracker}
          latestLog={selected.log}
          onClose={() => setSelected(null)}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  card: {
    backgroundColor: "#1f2937", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#374151",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  trackerName: { flex: 1, color: "#fff", fontWeight: "600", fontSize: 15 },
  chevron: { color: "#6b7280", fontSize: 20 },
  cardBody: { gap: 4 },
  age: { color: "#9ca3af", fontSize: 12 },
  coord: { color: "#9ca3af", fontSize: 13, fontFamily: "monospace" },
  row: { flexDirection: "row", gap: 12 },
  time: { color: "#6b7280", fontSize: 12 },
  speed: { color: "#3b82f6", fontSize: 13, fontWeight: "600" },
  noData: { color: "#6b7280", fontSize: 13 },
  error: { color: "#f87171", padding: 16, fontSize: 13 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 40, fontSize: 14 },
});

const ms = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  close: { color: "#9ca3af", fontSize: 20, width: 32 },
  title: { color: "#fff", fontWeight: "700", fontSize: 16, flex: 1, textAlign: "center" },
  periods: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  periodBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 16, backgroundColor: "#1f2937",
    borderWidth: 1, borderColor: "#374151",
  },
  periodBtnActive: { backgroundColor: "#1d4ed8", borderColor: "#3b82f6" },
  periodText: { color: "#9ca3af", fontSize: 13 },
  periodTextActive: { color: "#fff", fontWeight: "600" },
  infoBar: {
    backgroundColor: "#1f2937", padding: 12, gap: 4,
    borderTopWidth: 1, borderTopColor: "#374151",
  },
  infoText: { color: "#9ca3af", fontSize: 12 },
  dotCurrent: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#3b82f6", borderWidth: 3, borderColor: "#fff",
  },
  dotStart: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#22c55e", borderWidth: 2, borderColor: "#fff",
  },
});
