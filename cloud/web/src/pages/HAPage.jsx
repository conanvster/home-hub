import { useEffect, useState, useCallback } from "react";
import { api } from "../services/api";
import AppHeader from "../components/AppHeader";

// ── Утиліти ───────────────────────────────────────────────────
const DEVICE_CLASS_ICON = {
  temperature:     "🌡️",
  humidity:        "💧",
  carbon_dioxide:  "🫁",
  motion:          "👁️",
  door:            "🚪",
  window:          "🪟",
  battery:         "🔋",
  power:           "⚡",
  energy:          "📊",
  voltage:         "🔌",
  illuminance:     "☀️",
  pressure:        "🌬️",
};

function entityIcon(state) {
  const dc = state.attributes?.device_class;
  if (dc && DEVICE_CLASS_ICON[dc]) return DEVICE_CLASS_ICON[dc];
  if (state.entity_id.startsWith("light.")) return "💡";
  if (state.entity_id.startsWith("switch.")) return "🔌";
  if (state.entity_id.startsWith("automation.")) return "⚙️";
  return "📡";
}

function friendlyName(state) {
  return state.attributes?.friendly_name || state.entity_id;
}

// ── Карта камери ──────────────────────────────────────────────
function CameraCard({ state, ts }) {
  const [error, setError] = useState(false);
  const entityId = state.entity_id;
  const src = `/api/ha/camera/${entityId}?t=${ts}`;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      <div className="relative bg-black aspect-video">
        {!error ? (
          <img
            key={ts}
            src={src}
            alt={friendlyName(state)}
            className="w-full h-full object-cover"
            onError={() => setError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
            Немає зображення
          </div>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-white text-sm font-medium">📷 {friendlyName(state)}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          state.state === "idle" ? "bg-green-900/60 text-green-300" : "bg-gray-700 text-gray-400"
        }`}>
          {state.state}
        </span>
      </div>
    </div>
  );
}

// ── Карта перемикача (light / switch) ─────────────────────────
function ToggleCard({ state, onToggle, toggling }) {
  const isOn = state.state === "on";
  const icon = entityIcon(state);

  return (
    <div
      className={`bg-gray-800 border rounded-xl p-4 flex items-center justify-between gap-3 transition ${
        isOn ? "border-yellow-600/50" : "border-gray-700"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`text-2xl ${isOn ? "" : "opacity-40"}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{friendlyName(state)}</p>
          <p className={`text-xs ${isOn ? "text-yellow-400" : "text-gray-500"}`}>
            {isOn ? "Увімкнено" : "Вимкнено"}
          </p>
        </div>
      </div>
      <button
        onClick={() => onToggle(state)}
        disabled={toggling}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          isOn ? "bg-yellow-500" : "bg-gray-600"
        } disabled:opacity-50`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          isOn ? "translate-x-5" : "translate-x-0.5"
        }`} />
      </button>
    </div>
  );
}

// ── Карта сенсора ─────────────────────────────────────────────
function SensorCard({ state }) {
  const value = state.state;
  const unit = state.attributes?.unit_of_measurement || "";
  const icon = entityIcon(state);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
      <span className="text-3xl">{icon}</span>
      <div className="min-w-0">
        <p className="text-gray-400 text-xs truncate">{friendlyName(state)}</p>
        <p className="text-white text-xl font-semibold">
          {isNaN(value) ? value : parseFloat(value).toFixed(1)}
          <span className="text-gray-400 text-sm ml-1">{unit}</span>
        </p>
      </div>
    </div>
  );
}

// ── Карта автоматизації ───────────────────────────────────────
function AutomationCard({ state, onTrigger, triggering }) {
  const isOn = state.state === "on";
  const lastTriggered = state.attributes?.last_triggered;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">⚙️</span>
          <p className="text-white text-sm font-medium truncate">{friendlyName(state)}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
            isOn ? "bg-green-900/60 text-green-300" : "bg-gray-700 text-gray-500"
          }`}>
            {isOn ? "увімк" : "вимк"}
          </span>
        </div>
        {lastTriggered && (
          <p className="text-gray-500 text-xs mt-1 ml-6">
            Остання: {new Date(lastTriggered).toLocaleString("uk-UA")}
          </p>
        )}
      </div>
      <button
        onClick={() => onTrigger(state)}
        disabled={triggering}
        className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition flex-shrink-0"
      >
        ▶
      </button>
    </div>
  );
}

// ── Секція ────────────────────────────────────────────────────
function Section({ title, children, count }) {
  if (count === 0) return null;
  return (
    <section>
      <h2 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
        {title}
        <span className="text-gray-500 text-xs bg-gray-700 rounded-full px-2 font-normal">{count}</span>
      </h2>
      {children}
    </section>
  );
}

// ── Головна сторінка ──────────────────────────────────────────
export default function HAPage() {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [triggering, setTriggering] = useState(null);
  const [camTs, setCamTs] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const data = await api.haStates();
      setStates(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const stateTimer = setInterval(load, 10000);          // стани кожні 10 сек
    const camTimer = setInterval(() => setCamTs(Date.now()), 30000); // камери кожні 30 сек
    return () => { clearInterval(stateTimer); clearInterval(camTimer); };
  }, [load]);

  async function toggle(state) {
    setToggling(state.entity_id);
    try {
      await api.haService("homeassistant", "toggle", { entity_id: state.entity_id });
      await load();
    } finally {
      setToggling(null);
    }
  }

  async function triggerAutomation(state) {
    setTriggering(state.entity_id);
    try {
      await api.haService("automation", "trigger", { entity_id: state.entity_id });
    } finally {
      setTriggering(null);
    }
  }

  // Групування
  const cameras    = states.filter((s) => s.entity_id.startsWith("camera.") && s.state !== "unavailable");
  const lights     = states.filter((s) => s.entity_id.startsWith("light."));
  const switches   = states.filter((s) => s.entity_id.startsWith("switch."));
  const electric   = [...lights, ...switches];
  const sensors    = states.filter(
    (s) => s.entity_id.startsWith("sensor.") &&
    s.attributes?.device_class &&
    !["timestamp"].includes(s.attributes.device_class) &&
    s.state !== "unavailable"
  );
  const automations = states.filter((s) => s.entity_id.startsWith("automation."));

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <AppHeader activePage="ha" />

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full flex flex-col gap-8">
        {loading && (
          <div className="text-gray-400 text-sm">Підключення до Home Assistant...</div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
            ❌ Помилка з'єднання: {error}
          </div>
        )}

        {/* ── Камери ─────────────────────────────────────────── */}
        <Section title="📷 Камери" count={cameras.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cameras.map((s) => (
              <CameraCard key={s.entity_id} state={s} ts={camTs} />
            ))}
          </div>
        </Section>

        {/* ── Електрика ──────────────────────────────────────── */}
        <Section title="⚡ Електрика" count={electric.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {electric.map((s) => (
              <ToggleCard
                key={s.entity_id}
                state={s}
                onToggle={toggle}
                toggling={toggling === s.entity_id}
              />
            ))}
          </div>
        </Section>

        {/* ── Клімат / Сенсори ───────────────────────────────── */}
        <Section title="🌡️ Клімат і сенсори" count={sensors.length}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {sensors.map((s) => (
              <SensorCard key={s.entity_id} state={s} />
            ))}
          </div>
        </Section>

        {/* ── Автоматизації ──────────────────────────────────── */}
        <Section title="⚙️ Автоматизації" count={automations.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {automations.map((s) => (
              <AutomationCard
                key={s.entity_id}
                state={s}
                onTrigger={triggerAutomation}
                triggering={triggering === s.entity_id}
              />
            ))}
          </div>
        </Section>

        {!loading && !error && states.length === 0 && (
          <div className="text-gray-500 text-sm">Немає entities в Home Assistant</div>
        )}
      </div>
    </div>
  );
}
