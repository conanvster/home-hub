import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Modal, ActivityIndicator, ScrollView,
  TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
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

// ── Leaflet HTML ──────────────────────────────────────────────
function buildMapHtml(lat, lon, route) {
  const routeJson = JSON.stringify(route);
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: #111827; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var lat = ${lat}, lon = ${lon};
  var route = ${routeJson};
  var map = L.map('map', { zoomControl: true }).setView([lat, lon], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OSM', maxZoom: 19
  }).addTo(map);

  // Маршрут
  if (route.length > 1) {
    var poly = L.polyline(route, { color: '#3b82f6', weight: 4, opacity: 0.9 }).addTo(map);
    map.fitBounds(poly.getBounds(), { padding: [30, 30] });
    // Початок
    L.circleMarker(route[0], {
      radius: 7, fillColor: '#22c55e', color: '#fff', weight: 2, fillOpacity: 1
    }).bindPopup('Початок маршруту').addTo(map);
  }

  // Поточна позиція
  L.circleMarker([lat, lon], {
    radius: 10, fillColor: '#3b82f6', color: '#fff', weight: 3, fillOpacity: 1
  }).bindPopup('Поточна позиція').addTo(map).openPopup();
</script>
</body>
</html>`;
}

// ── Модалка карти ─────────────────────────────────────────────
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
        .map((l) => [l.latitude, l.longitude])
        .reverse();
      setRoute(coords);
    } catch {}
    setLoadingRoute(false);
  }, [tracker?.imei, period]);

  useEffect(() => { loadRoute(); }, [loadRoute]);

  const hasPosition = latestLog?.latitude != null && latestLog?.longitude != null;
  const lat = hasPosition ? latestLog.latitude : 48.5;
  const lon = hasPosition ? latestLog.longitude : 32.0;

  const html = buildMapHtml(lat, lon, route);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#111827" }}>
        {/* Header */}
        <View style={ms.header}>
          <TouchableOpacity onPress={onClose} style={{ width: 40 }}>
            <Text style={ms.close}>✕</Text>
          </TouchableOpacity>
          <Text style={ms.title} numberOfLines={1}>{tracker.name || tracker.imei}</Text>
          <View style={{ width: 40 }} />
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

        {/* Leaflet map */}
        <WebView
          style={{ flex: 1 }}
          source={{ html }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#111827" }}>
              <ActivityIndicator color="#3b82f6" />
            </View>
          )}
        />

        {/* Info bar */}
        {hasPosition && (
          <View style={ms.infoBar}>
            <Text style={ms.infoText}>
              📍 {lat.toFixed(5)}, {lon.toFixed(5)}
              {latestLog.speed != null ? `  · ${Math.round(latestLog.speed)} км/год` : ""}
            </Text>
            <Text style={ms.infoText}>🕐 {formatTime(latestLog.deviceTime)}</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── Зони ──────────────────────────────────────────────────────
const ZONE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function ZoneFormModal({ onClose, onSave }) {
  const [name,   setName]   = useState("");
  const [lat,    setLat]    = useState("");
  const [lon,    setLon]    = useState("");
  const [radius, setRadius] = useState("200");
  const [color,  setColor]  = useState(ZONE_COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !lat.trim() || !lon.trim()) {
      Alert.alert("Помилка", "Заповніть назву та координати"); return;
    }
    const latN = parseFloat(lat), lonN = parseFloat(lon), radN = parseInt(radius) || 200;
    if (isNaN(latN) || isNaN(lonN)) {
      Alert.alert("Помилка", "Некоректні координати"); return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), lat: latN, lng: lonN, radius: radN, color });
      onClose();
    } catch (err) {
      Alert.alert("Помилка", err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#111827" }}>
        <View style={ms.header}>
          <TouchableOpacity onPress={onClose}><Text style={ms.close}>✕</Text></TouchableOpacity>
          <Text style={ms.title}>Нова зона</Text>
          <TouchableOpacity onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#3b82f6" /> : <Text style={{ color: "#3b82f6", fontWeight: "600" }}>Зберегти</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <TextInput
            style={zs.input}
            value={name}
            onChangeText={setName}
            placeholder="Назва зони"
            placeholderTextColor="#6b7280"
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[zs.input, { flex: 1 }]}
              value={lat}
              onChangeText={setLat}
              placeholder="Широта (напр. 49.3900)"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
            />
            <TextInput
              style={[zs.input, { flex: 1 }]}
              value={lon}
              onChangeText={setLon}
              placeholder="Довгота (напр. 36.2100)"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
            />
          </View>
          <TextInput
            style={zs.input}
            value={radius}
            onChangeText={setRadius}
            placeholder="Радіус (метри)"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
          />
          <View>
            <Text style={{ color: "#9ca3af", fontSize: 12, marginBottom: 8 }}>Колір</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {ZONE_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={[zs.colorDot, { backgroundColor: c }, color === c && zs.colorDotActive]}
                />
              ))}
            </View>
          </View>
          <Text style={{ color: "#6b7280", fontSize: 12 }}>
            💡 Координати можна знайти на maps.google.com (клік → "Що тут?")
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ZonesTab() {
  const [zones,      setZones]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getZones();
      setZones(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(zone) {
    Alert.alert(
      "Видалити зону",
      `Видалити "${zone.name}"?`,
      [
        { text: "Скасувати", style: "cancel" },
        {
          text: "Видалити", style: "destructive",
          onPress: async () => {
            try { await api.deleteZone(zone._id); await load(); }
            catch (err) { Alert.alert("Помилка", err.message); }
          },
        },
      ]
    );
  }

  async function handleSave(data) {
    await api.createZone(data);
    await load();
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={zs.header}>
        <Text style={zs.headerTitle}>🗺️ Геозони</Text>
        <TouchableOpacity style={zs.addBtn} onPress={() => setShowForm(true)}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>+ Зона</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <ActivityIndicator color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={zones}
          keyExtractor={(z) => z._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#3b82f6"
            />
          }
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <Text style={{ color: "#6b7280", textAlign: "center", marginTop: 40 }}>
              Немає геозон. Додайте першу!
            </Text>
          }
          renderItem={({ item: z }) => (
            <View style={zs.zoneCard}>
              <View style={[zs.colorBar, { backgroundColor: z.color || "#3b82f6" }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={zs.zoneName}>{z.name}</Text>
                <Text style={zs.zoneMeta}>
                  📍 {z.lat?.toFixed(4)}, {z.lng?.toFixed(4)}  ·  ⭕ {z.radius} м
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(z)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: "#6b7280", fontSize: 20, lineHeight: 28 }}>🗑</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {showForm && (
        <ZoneFormModal
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}
    </View>
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
  const [tab,        setTab]        = useState("trackers"); // "trackers" | "zones"
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [selected,   setSelected]   = useState(null);

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
      {/* Вкладки */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tabBtn, tab === "trackers" && s.tabBtnActive]}
          onPress={() => setTab("trackers")}
        >
          <Text style={[s.tabText, tab === "trackers" && s.tabTextActive]}>📡 Трекери</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === "zones" && s.tabBtnActive]}
          onPress={() => setTab("zones")}
        >
          <Text style={[s.tabText, tab === "zones" && s.tabTextActive]}>🗺️ Зони</Text>
        </TouchableOpacity>
      </View>

      {tab === "zones" ? (
        <ZonesTab />
      ) : (
        <>
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
        </>
      )}

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
  container:    { flex: 1, backgroundColor: "#111827" },
  tabBar:       { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#374151", backgroundColor: "#1f2937" },
  tabBtn:       { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: "#3b82f6" },
  tabText:      { color: "#6b7280", fontSize: 14, fontWeight: "500" },
  tabTextActive:{ color: "#3b82f6", fontWeight: "700" },
  card:         { backgroundColor: "#1f2937", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#374151" },
  cardHeader:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dot:          { width: 8, height: 8, borderRadius: 4 },
  trackerName:  { flex: 1, color: "#fff", fontWeight: "600", fontSize: 15 },
  chevron:      { color: "#6b7280", fontSize: 20 },
  cardBody:     { gap: 4 },
  age:          { color: "#9ca3af", fontSize: 12 },
  coord:        { color: "#9ca3af", fontSize: 13, fontFamily: "monospace" },
  row:          { flexDirection: "row", gap: 12 },
  time:         { color: "#6b7280", fontSize: 12 },
  speed:        { color: "#3b82f6", fontSize: 13, fontWeight: "600" },
  noData:       { color: "#6b7280", fontSize: 13 },
  error:        { color: "#f87171", padding: 16, fontSize: 13 },
  empty:        { color: "#6b7280", textAlign: "center", marginTop: 40, fontSize: 14 },
});

const ms = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  close: { color: "#9ca3af", fontSize: 20 },
  title: { color: "#fff", fontWeight: "700", fontSize: 16, flex: 1, textAlign: "center" },
  periods: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#374151",
    backgroundColor: "#1f2937",
  },
  periodBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: "#374151" },
  periodBtnActive: { backgroundColor: "#1d4ed8" },
  periodText:      { color: "#9ca3af", fontSize: 13 },
  periodTextActive:{ color: "#fff", fontWeight: "600" },
  infoBar:         { backgroundColor: "#1f2937", padding: 12, gap: 4, borderTopWidth: 1, borderTopColor: "#374151" },
  infoText:        { color: "#9ca3af", fontSize: 12 },
});

const zs = StyleSheet.create({
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#374151" },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  addBtn:      { backgroundColor: "#1d4ed8", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  zoneCard:    { backgroundColor: "#1f2937", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#374151", flexDirection: "row", alignItems: "center", gap: 12 },
  colorBar:    { width: 4, height: 40, borderRadius: 2 },
  zoneName:    { color: "#fff", fontSize: 14, fontWeight: "600" },
  zoneMeta:    { color: "#6b7280", fontSize: 12 },
  input:       { backgroundColor: "#1f2937", color: "#fff", borderRadius: 12, padding: 12, fontSize: 14, borderWidth: 1, borderColor: "#374151" },
  colorDot:    { width: 28, height: 28, borderRadius: 14 },
  colorDotActive: { borderWidth: 3, borderColor: "#fff" },
});
