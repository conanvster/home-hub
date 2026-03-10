import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, RefreshControl, Image, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/services/api";
import { useSettingsStore } from "../../src/store/useSettingsStore";

const DEVICE_CLASS_ICON = {
  temperature: "🌡️", humidity: "💧", carbon_dioxide: "🫁",
  motion: "👁️", door: "🚪", window: "🪟", battery: "🔋",
  power: "⚡", energy: "📊", voltage: "🔌", illuminance: "☀️", pressure: "🌬️",
};

function entityIcon(state) {
  const dc = state.attributes?.device_class;
  if (dc && DEVICE_CLASS_ICON[dc]) return DEVICE_CLASS_ICON[dc];
  if (state.entity_id.startsWith("light.")) return "💡";
  if (state.entity_id.startsWith("switch.")) return "🔌";
  if (state.entity_id.startsWith("camera.")) return "📷";
  if (state.entity_id.startsWith("automation.")) return "⚙️";
  return "📡";
}

function friendlyName(state) {
  return state.attributes?.friendly_name || state.entity_id;
}

// ── Секція ────────────────────────────────────────────────────
function Section({ title, children, count }) {
  const [open, setOpen] = useState(true);
  if (count === 0) return null;
  return (
    <View style={s.section}>
      <TouchableOpacity style={s.sectionHeader} onPress={() => setOpen((v) => !v)}>
        <Text style={s.sectionArrow}>{open ? "▼" : "▶"}</Text>
        <Text style={s.sectionTitle}>{title}</Text>
        <View style={s.badge}><Text style={s.badgeText}>{count}</Text></View>
      </TouchableOpacity>
      {open && children}
    </View>
  );
}

// ── Камера ────────────────────────────────────────────────────
function CameraCard({ state, ts, localUrl }) {
  const src = `${localUrl}/api/ha/camera/${state.entity_id}?t=${ts}`;
  return (
    <View style={s.cameraCard}>
      <Image
        source={{ uri: src }}
        style={s.cameraImg}
        resizeMode="cover"
      />
      <Text style={s.cameraLabel}>📷 {friendlyName(state)}</Text>
    </View>
  );
}

// ── Toggle ────────────────────────────────────────────────────
function ToggleCard({ state, onToggle, toggling }) {
  const isOn = state.state === "on";
  return (
    <View style={[s.toggleCard, isOn && s.toggleCardOn]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        <Text style={{ fontSize: 22, opacity: isOn ? 1 : 0.4 }}>{entityIcon(state)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.entityName} numberOfLines={1}>{friendlyName(state)}</Text>
          <Text style={[s.entityState, { color: isOn ? "#facc15" : "#6b7280" }]}>
            {isOn ? "Увімкнено" : "Вимкнено"}
          </Text>
        </View>
      </View>
      <Switch
        value={isOn}
        onValueChange={() => onToggle(state)}
        disabled={toggling}
        trackColor={{ false: "#4b5563", true: "#ca8a04" }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ── Сенсор ────────────────────────────────────────────────────
function SensorCard({ state }) {
  const value = state.state;
  const unit = state.attributes?.unit_of_measurement || "";
  return (
    <View style={s.sensorCard}>
      <Text style={{ fontSize: 26 }}>{entityIcon(state)}</Text>
      <Text style={s.sensorLabel} numberOfLines={1}>{friendlyName(state)}</Text>
      <Text style={s.sensorValue}>
        {isNaN(value) ? value : parseFloat(value).toFixed(1)}
        <Text style={s.sensorUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

// ── Автоматизація ─────────────────────────────────────────────
function AutomationCard({ state, onTrigger, triggering }) {
  const isOn = state.state === "on";
  return (
    <View style={s.autoCard}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={s.entityName} numberOfLines={1}>{friendlyName(state)}</Text>
          <View style={[s.badge, { backgroundColor: isOn ? "#14532d" : "#374151" }]}>
            <Text style={[s.badgeText, { color: isOn ? "#86efac" : "#9ca3af" }]}>
              {isOn ? "увімк" : "вимк"}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={[s.triggerBtn, triggering && { opacity: 0.5 }]}
        onPress={() => onTrigger(state)}
        disabled={triggering}
      >
        <Text style={{ color: "#fff", fontSize: 13 }}>▶</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Головний екран ────────────────────────────────────────────
export default function HAScreen() {
  const localUrl = useSettingsStore((s) => s.localUrl);
  const localOnline = useSettingsStore((s) => s.localOnline);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [triggering, setTriggering] = useState(null);
  const [camTs, setCamTs] = useState(Date.now());

  const load = useCallback(async () => {
    console.log("HA load: localUrl =", localUrl);
    try {
      const data = await api.haStates();
      console.log("HA states count:", data?.length);
      setStates(data);
      setError(null);
    } catch (err) {
      console.error("HA load error:", err.message, err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (localOnline === false) return; // не поллити якщо сервер офлайн
    load();
    const stateTimer = setInterval(load, 10000);
    const camTimer = setInterval(() => setCamTs(Date.now()), 5000);
    return () => { clearInterval(stateTimer); clearInterval(camTimer); };
  }, [load, localOnline]);

  async function toggle(state) {
    setToggling(state.entity_id);
    try {
      await api.haService("homeassistant", "toggle", { entity_id: state.entity_id });
      await load();
    } finally {
      setToggling(null);
    }
  }

  async function triggerAuto(state) {
    setTriggering(state.entity_id);
    try {
      await api.haService("automation", "trigger", { entity_id: state.entity_id });
    } finally {
      setTriggering(null);
    }
  }

  const cameras = states.filter((s) => s.entity_id.startsWith("camera.") && s.state !== "unavailable");
  const electric = states.filter((s) => s.entity_id.startsWith("light.") || s.entity_id.startsWith("switch."));
  const sensors = states.filter(
    (s) => s.entity_id.startsWith("sensor.") &&
    s.attributes?.device_class &&
    !["timestamp"].includes(s.attributes.device_class) &&
    s.state !== "unavailable"
  );
  const automations = states.filter((s) => s.entity_id.startsWith("automation."));

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>🏡 Дім</Text>
        {loading && !refreshing && <ActivityIndicator size="small" color="#3b82f6" />}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />}
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        {localOnline === false && (
          <View style={s.offlineBanner}>
            <Text style={s.offlineText}>📡 Локальний сервер недоступний</Text>
            <Text style={s.offlineHint}>Перевірте Wi-Fi або адресу сервера в налаштуваннях</Text>
          </View>
        )}
        {error && localOnline !== false && <Text style={s.error}>❌ {error}</Text>}

        {/* Камери */}
        <Section title="📷 Камери" count={cameras.length}>
          {cameras.map((state) => (
            <CameraCard key={state.entity_id} state={state} ts={camTs} localUrl={localUrl} />
          ))}
        </Section>

        {/* Електрика */}
        <Section title="⚡ Електрика" count={electric.length}>
          {electric.map((state) => (
            <ToggleCard
              key={state.entity_id}
              state={state}
              onToggle={toggle}
              toggling={toggling === state.entity_id}
            />
          ))}
        </Section>

        {/* Клімат */}
        <Section title="🌡️ Клімат і сенсори" count={sensors.length}>
          <View style={s.sensorGrid}>
            {sensors.map((state) => (
              <SensorCard key={state.entity_id} state={state} />
            ))}
          </View>
        </Section>

        {/* Автоматизації */}
        <Section title="⚙️ Автоматизації" count={automations.length}>
          {automations.map((state) => (
            <AutomationCard
              key={state.entity_id}
              state={state}
              onTrigger={triggerAuto}
              triggering={triggering === state.entity_id}
            />
          ))}
        </Section>

        {!loading && !error && states.length === 0 && (
          <Text style={s.empty}>Немає entities в Home Assistant</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#374151" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  error: { color: "#f87171", backgroundColor: "#7f1d1d44", padding: 12, borderRadius: 10, fontSize: 13 },
  offlineBanner: { backgroundColor: "#1c1f2e", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#374151", alignItems: "center", gap: 4 },
  offlineText: { color: "#f59e0b", fontSize: 15, fontWeight: "600" },
  offlineHint: { color: "#6b7280", fontSize: 12 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 40, fontSize: 14 },

  // Section
  section: { gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  sectionArrow: { color: "#6b7280", fontSize: 11 },
  sectionTitle: { color: "#fff", fontWeight: "600", fontSize: 15, flex: 1 },
  badge: { backgroundColor: "#374151", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#9ca3af", fontSize: 11 },

  // Camera
  cameraCard: { backgroundColor: "#1f2937", borderRadius: 12, overflow: "hidden", marginBottom: 4, borderWidth: 1, borderColor: "#374151" },
  cameraImg: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  cameraLabel: { color: "#fff", fontSize: 13, padding: 8 },

  // Toggle
  toggleCard: { backgroundColor: "#1f2937", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#374151", marginBottom: 4 },
  toggleCardOn: { borderColor: "#854d0e" },
  entityName: { color: "#fff", fontSize: 14, fontWeight: "500" },
  entityState: { fontSize: 12, marginTop: 2 },

  // Sensor
  sensorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sensorCard: { backgroundColor: "#1f2937", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#374151", width: "47%", gap: 4 },
  sensorLabel: { color: "#9ca3af", fontSize: 11 },
  sensorValue: { color: "#fff", fontSize: 18, fontWeight: "700" },
  sensorUnit: { color: "#9ca3af", fontSize: 12 },

  // Automation
  autoCard: { backgroundColor: "#1f2937", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#374151", marginBottom: 4 },
  triggerBtn: { backgroundColor: "#1d4ed8", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 8 },
});
