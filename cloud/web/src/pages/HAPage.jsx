import { useEffect, useState, useCallback, useRef } from "react";
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
  if (state.entity_id.startsWith("camera.")) return "📷";
  return "📡";
}

function friendlyName(state) {
  return state.attributes?.friendly_name || state.entity_id;
}

// ── Popup камери (MJPEG stream) ───────────────────────────────
function CameraModal({ state, onClose }) {
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef(null);
  const entityId = state.entity_id;

  // Закриття по Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fullscreen API
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  useEffect(() => {
    function onFsChange() { setFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={containerRef}
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: "min(90vw, 960px)", resize: "both", minWidth: 320, minHeight: 240 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <span className="text-white text-sm font-medium">📷 {friendlyName(state)}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-700 transition"
              title={fullscreen ? "Вийти з повноекранного" : "Повний екран"}
            >
              {fullscreen ? "⊡" : "⛶"}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-700 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* MJPEG stream — браузер нативно програє потік */}
        <div className="flex-1 bg-black overflow-hidden min-h-0">
          <img
            src={`/api/ha/camera-stream/${entityId}`}
            alt={friendlyName(state)}
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

// ── Карта камери ──────────────────────────────────────────────
function CameraCard({ state, ts, onOpen }) {
  const [error, setError] = useState(false);
  const entityId = state.entity_id;
  const src = `/api/ha/camera/${entityId}?t=${ts}`;

  return (
    <div
      className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden cursor-pointer hover:border-gray-500 transition"
      onClick={onOpen}
    >
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
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition">
          <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg">⛶ Розгорнути</span>
        </div>
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

// ── Камера дашборду — double buffer (без мигання) ─────────────
function DashCameraCard({ state, ts, onOpenCamera }) {
  const entityId = state.entity_id;
  const initSrc = `/api/ha/camera/${entityId}?t=${ts}`;

  // frontRef — для читання в ефекті без stale closure
  // front state — для рендеру opacity
  const frontRef = useRef(0);
  const [front, setFront] = useState(0);
  const [srcs, setSrcs] = useState([initSrc, initSrc]);

  useEffect(() => {
    const next = `/api/ha/camera/${entityId}?t=${ts}`;
    const back = frontRef.current === 0 ? 1 : 0;
    const img = new Image();
    img.onload = () => {
      setSrcs((prev) => { const a = [...prev]; a[back] = next; return a; });
      frontRef.current = back;
      setFront(back);
    };
    img.src = next;
    // Скасувати якщо ts змінився до завантаження
    return () => { img.onload = null; };
  }, [ts, entityId]);

  return (
    <div
      className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden cursor-pointer hover:border-gray-500 transition"
      onClick={onOpenCamera}
    >
      <div className="relative w-full aspect-video bg-black">
        {srcs.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={friendlyName(state)}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: i === front ? 1 : 0 }}
          />
        ))}
      </div>
      <p className="text-white text-xs px-2 py-1 truncate">{friendlyName(state)}</p>
    </div>
  );
}

// ── Мінімальна плитка entity для дашборду ────────────────────
function DashEntityCard({ state, ts, onToggle, toggling, onOpenCamera }) {
  if (!state) return null;
  const id = state.entity_id;

  if (id.startsWith("camera.")) {
    return <DashCameraCard state={state} ts={ts} onOpenCamera={onOpenCamera} />;
  }

  if (id.startsWith("light.") || id.startsWith("switch.")) {
    const isOn = state.state === "on";
    return (
      <div
        className={`bg-gray-900 border rounded-lg p-3 flex items-center justify-between gap-2 ${
          isOn ? "border-yellow-600/40" : "border-gray-700"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xl ${isOn ? "" : "opacity-40"}`}>{entityIcon(state)}</span>
          <p className="text-white text-xs truncate">{friendlyName(state)}</p>
        </div>
        <button
          onClick={() => onToggle(state)}
          disabled={toggling}
          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
            isOn ? "bg-yellow-500" : "bg-gray-600"
          } disabled:opacity-50`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            isOn ? "translate-x-4" : "translate-x-0.5"
          }`} />
        </button>
      </div>
    );
  }

  // sensor / automation / інше
  const value = state.state;
  const unit = state.attributes?.unit_of_measurement || "";
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 flex items-center gap-2">
      <span className="text-xl">{entityIcon(state)}</span>
      <div className="min-w-0">
        <p className="text-gray-400 text-xs truncate">{friendlyName(state)}</p>
        <p className="text-white text-sm font-semibold">
          {isNaN(value) ? value : parseFloat(value).toFixed(1)}
          {unit && <span className="text-gray-400 text-xs ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

// ── Секція (згортна) ──────────────────────────────────────────
function Section({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-white font-semibold text-base mb-3 group"
      >
        <span className="text-gray-500 text-xs transition-transform" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
        {title}
        <span className="text-gray-500 text-xs bg-gray-700 rounded-full px-2 font-normal">{count}</span>
      </button>
      {open && children}
    </section>
  );
}

// ── Дашборд ───────────────────────────────────────────────────
const ENTITY_DND_TYPE = "ha-entity";
const CONTAINER_DND_TYPE = "ha-container";

function Dashboard({ containers, statesMap, ts, onToggle, toggling, onChange, onOpenCamera }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const dragEntity = useRef(null);    // { entityId, fromContainerId }
  const dragContainer = useRef(null); // containerId

  // Drag entity (within dashboard)
  function onEntityDragStart(e, entityId, fromContainerId) {
    dragEntity.current = { entityId, fromContainerId };
    dragContainer.current = null;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", ENTITY_DND_TYPE);
    e.dataTransfer.setData("entityId", entityId);
    e.dataTransfer.setData("fromContainerId", fromContainerId);
  }

  function onContainerDragStart(e, containerId) {
    dragContainer.current = containerId;
    dragEntity.current = null;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", CONTAINER_DND_TYPE);
  }

  function onDropOnContainer(e, toContainerId) {
    e.preventDefault();
    const type = e.dataTransfer.getData("type");

    if (type === ENTITY_DND_TYPE) {
      const entityId = e.dataTransfer.getData("entityId");
      const fromContainerId = e.dataTransfer.getData("fromContainerId") || null;
      dragEntity.current = null;
      if (!entityId) return;
      // Already in target container — skip
      const targetContainer = containers.find((c) => c.id === toContainerId);
      if (targetContainer?.entities.includes(entityId)) return;

      const next = containers.map((c) => {
        if (fromContainerId && c.id === fromContainerId)
          return { ...c, entities: c.entities.filter((x) => x !== entityId) };
        if (c.id === toContainerId)
          return { ...c, entities: [...c.entities, entityId] };
        return c;
      });
      onChange(next);
    }
  }

  function onDropOnContainerHeader(e, toIdx) {
    e.preventDefault();
    const type = e.dataTransfer.getData("type");
    if (type === CONTAINER_DND_TYPE && dragContainer.current) {
      const fromIdx = containers.findIndex((c) => c.id === dragContainer.current);
      dragContainer.current = null;
      if (fromIdx === -1 || fromIdx === toIdx) return;
      const next = [...containers];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      onChange(next);
    }
  }

  function addContainer() {
    const id = `c_${Date.now()}`;
    onChange([...containers, { id, name: "Контейнер", entities: [] }]);
  }

  function removeContainer(id) {
    onChange(containers.filter((c) => c.id !== id));
  }

  function removeEntity(containerId, entityId) {
    onChange(containers.map((c) =>
      c.id === containerId ? { ...c, entities: c.entities.filter((e) => e !== entityId) } : c
    ));
  }

  function startRename(c) {
    setEditingId(c.id);
    setEditName(c.name);
  }

  function commitRename(id) {
    onChange(containers.map((c) => c.id === id ? { ...c, name: editName || c.name } : c));
    setEditingId(null);
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-white font-semibold text-base">🗂️ Дашборд</h2>
        <button
          onClick={addContainer}
          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
        >
          + Контейнер
        </button>
      </div>

      {containers.length === 0 && (
        <p className="text-gray-600 text-sm">Додайте контейнер та перетягніть entities з секцій нижче</p>
      )}

      <div className="flex flex-wrap gap-4">
        {containers.map((c, idx) => (
          <div
            key={c.id}
            draggable
            onDragStart={(e) => onContainerDragStart(e, c.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropOnContainerHeader(e, idx)}
            className="bg-gray-800 border border-gray-700 rounded-xl p-3 min-w-[220px] max-w-[320px] flex-1 flex flex-col gap-2"
          >
            {/* Container header */}
            <div className="flex items-center gap-2 cursor-grab">
              <span className="text-gray-500 text-xs">⠿</span>
              {editingId === c.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(c.id)}
                  onKeyDown={(e) => e.key === "Enter" && commitRename(c.id)}
                  className="flex-1 bg-gray-700 text-white text-sm rounded px-2 py-0.5 outline-none"
                />
              ) : (
                <span
                  className="flex-1 text-white text-sm font-medium truncate cursor-text"
                  onDoubleClick={() => startRename(c)}
                  title="Двічі клікніть щоб перейменувати"
                >
                  {c.name}
                </span>
              )}
              <button
                onClick={() => removeContainer(c.id)}
                className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropOnContainer(e, c.id)}
              className={`flex flex-col gap-2 min-h-[60px] rounded-lg border-2 border-dashed p-1 transition ${
                c.entities.length === 0 ? "border-gray-700" : "border-transparent"
              }`}
            >
              {c.entities.length === 0 && (
                <p className="text-gray-600 text-xs text-center py-3">Перетягніть сюди</p>
              )}
              {c.entities.map((eid) => {
                const state = statesMap[eid];
                return (
                  <div
                    key={eid}
                    draggable
                    onDragStart={(e) => onEntityDragStart(e, eid, c.id)}
                    className="relative group cursor-grab active:cursor-grabbing"
                  >
                    <DashEntityCard state={state} ts={ts} onToggle={onToggle} toggling={toggling === eid} onOpenCamera={state ? () => onOpenCamera(state) : undefined} />
                    <button
                      onClick={() => removeEntity(c.id, eid)}
                      className="absolute top-1 right-1 text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Перетягувана entity (з секції на дашборд) ─────────────────
function DraggableEntity({ state, children }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("type", ENTITY_DND_TYPE);
        e.dataTransfer.setData("entityId", state.entity_id);
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
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
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [containers, setContainers] = useState([]);
  const [dashSaving, setDashSaving] = useState(false);
  const saveTimer = useRef(null);

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
    api.haGetDashboard().then((doc) => setContainers(doc.containers || [])).catch(() => {});
    const stateTimer = setInterval(load, 10000);
    const camTimer = setInterval(() => setCamTs(Date.now()), 2000);
    return () => { clearInterval(stateTimer); clearInterval(camTimer); };
  }, [load]);

  // Debounce save
  function handleContainersChange(next) {
    setContainers(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setDashSaving(true);
      try { await api.haUpdateDashboard(next); } catch {}
      setDashSaving(false);
    }, 800);
  }

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

  const statesMap = Object.fromEntries(states.map((s) => [s.entity_id, s]));

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <AppHeader activePage="ha" />

      {selectedCamera && (
        <CameraModal state={selectedCamera} onClose={() => setSelectedCamera(null)} />
      )}

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full flex flex-col gap-8">
        {loading && (
          <div className="text-gray-400 text-sm">Підключення до Home Assistant...</div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
            ❌ Помилка з'єднання: {error}
          </div>
        )}

        {/* ── Дашборд ─────────────────────────────────────────── */}
        <Dashboard
          containers={containers}
          statesMap={statesMap}
          ts={camTs}
          onToggle={toggle}
          toggling={toggling}
          onChange={handleContainersChange}
          onOpenCamera={setSelectedCamera}
        />
        {dashSaving && <p className="text-gray-600 text-xs -mt-6">Збереження...</p>}

        {/* ── Камери ─────────────────────────────────────────── */}
        <Section title="📷 Камери" count={cameras.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cameras.map((s) => (
              <DraggableEntity key={s.entity_id} state={s}>
                <CameraCard state={s} ts={camTs} onOpen={() => setSelectedCamera(s)} />
              </DraggableEntity>
            ))}
          </div>
        </Section>

        {/* ── Електрика ──────────────────────────────────────── */}
        <Section title="⚡ Електрика" count={electric.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {electric.map((s) => (
              <DraggableEntity key={s.entity_id} state={s}>
                <ToggleCard
                  state={s}
                  onToggle={toggle}
                  toggling={toggling === s.entity_id}
                />
              </DraggableEntity>
            ))}
          </div>
        </Section>

        {/* ── Клімат / Сенсори ───────────────────────────────── */}
        <Section title="🌡️ Клімат і сенсори" count={sensors.length}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {sensors.map((s) => (
              <DraggableEntity key={s.entity_id} state={s}>
                <SensorCard state={s} />
              </DraggableEntity>
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
