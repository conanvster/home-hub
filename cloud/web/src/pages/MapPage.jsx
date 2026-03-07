import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import { io } from "socket.io-client";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CENTER = [49.39, 36.21];

function MapFlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, map.getZoom());
  }, [center]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick && onMapClick(e.latlng) });
  return null;
}

// ── Іконки ────────────────────────────────────────────────
function IconMap() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// ── Панель Трекінг ─────────────────────────────────────────
function TrackingPanel({ trackers, latest, selectedImei, onSelect, dateFrom, dateTo, onDateFrom, onDateTo }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      <h2 className="font-semibold text-white">Трекінг</h2>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400 uppercase tracking-wider">Діапазон</label>
        <input
          type="date"
          value={dateFrom}
          max={todayStr}
          onChange={(e) => onDateFrom(e.target.value)}
          className="bg-gray-700 text-white text-xs rounded px-2 py-1"
        />
        <input
          type="date"
          value={dateTo}
          max={todayStr}
          onChange={(e) => onDateTo(e.target.value)}
          className="bg-gray-700 text-white text-xs rounded px-2 py-1"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-400 uppercase tracking-wider">Трекери</label>
        {trackers.map((t) => {
          const pos = latest[t.imei];
          return (
            <button
              key={t.imei}
              onClick={() => onSelect(t.imei === selectedImei ? null : t.imei)}
              className={`text-left p-3 rounded-lg transition ${
                selectedImei === t.imei ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: t.color || "#3b82f6" }}
                />
                <span className="font-medium text-sm">{t.name}</span>
              </div>
              {pos && (
                <div className="text-xs text-gray-300 mt-1 pl-4">
                  {pos.speed.toFixed(0)} км/г · {new Date(pos.deviceTime).toLocaleString("uk")}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Панель Налаштування ────────────────────────────────────
function SettingsPanel({ trackers, onTrackersChange, zones, onZonesChange, pickingZone, setPickingZone, pendingZoneCoord, clearPendingCoord, me }) {
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addForm, setAddForm] = useState({ name: "", imei: "", color: "#3b82f6", active: true });
  const [adding, setAdding] = useState(false);

  const [zoneEditId, setZoneEditId] = useState(null);
  const [zoneEditForm, setZoneEditForm] = useState({});
  const [addingZone, setAddingZone] = useState(false);
  const [zoneForm, setZoneForm] = useState({ name: "", lat: "", lng: "", radius: 500, color: "#f59e0b" });

  function startEdit(t) {
    setEditId(t._id);
    setEditForm({ name: t.name, color: t.color || "#3b82f6", active: t.active ?? true });
  }

  async function saveEdit(id) {
    await api.updateTracker(id, editForm);
    setEditId(null);
    onTrackersChange();
  }

  async function deleteTracker(id) {
    if (!confirm("Видалити трекер?")) return;
    await api.deleteTracker(id);
    onTrackersChange();
  }

  async function addTracker() {
    if (!addForm.name || !addForm.imei) return;
    await api.createTracker(addForm);
    setAddForm({ name: "", imei: "", color: "#3b82f6", active: true });
    setAdding(false);
    onTrackersChange();
  }

  async function saveZone() {
    if (!zoneForm.name || zoneForm.lat === "" || zoneForm.lng === "") return;
    await api.createZone({ ...zoneForm, lat: Number(zoneForm.lat), lng: Number(zoneForm.lng), radius: Number(zoneForm.radius) });
    setZoneForm({ name: "", lat: "", lng: "", radius: 500, color: "#f59e0b" });
    setAddingZone(false);
    setPickingZone(false);
    onZonesChange();
  }

  async function saveZoneEdit(id) {
    await api.updateZone(id, { ...zoneEditForm, lat: Number(zoneEditForm.lat), lng: Number(zoneEditForm.lng), radius: Number(zoneEditForm.radius) });
    setZoneEditId(null);
    onZonesChange();
  }

  async function deleteZone(id) {
    if (!confirm("Видалити зону?")) return;
    await api.deleteZone(id);
    onZonesChange();
  }

  // Отримуємо координати з карти після кліку
  useEffect(() => {
    if (pendingZoneCoord) {
      setZoneForm(f => ({ ...f, lat: pendingZoneCoord.lat.toFixed(6), lng: pendingZoneCoord.lng.toFixed(6) }));
      clearPendingCoord();
    }
  }, [pendingZoneCoord]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <h2 className="font-semibold text-white">Налаштування</h2>

      {/* Telegram */}
      <div className="bg-gray-700 rounded-lg p-3">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Telegram</div>
        {me?.telegramId ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <span className="text-green-400 font-medium">Підключено</span>
            <span className="text-gray-400 text-xs ml-auto font-mono">{me.telegramId}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0" />
              <span className="text-gray-400">Не підключено</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Напишіть боту <span className="text-blue-400">@PrivatHomeBaseBot</span>:<br />
              <span className="font-mono">/register ваш@email.com</span>
            </div>
          </div>
        )}
      </div>

      {/* Трекери */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400 uppercase tracking-wider">Трекери</label>
          <button
            onClick={() => setAdding(!adding)}
            className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded transition"
          >
            + Додати
          </button>
        </div>

        {adding && (
          <div className="bg-gray-700 rounded-lg p-3 mb-3 flex flex-col gap-2">
            <input
              placeholder="Назва"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              className="bg-gray-600 text-white text-sm rounded px-2 py-1 w-full"
            />
            <input
              placeholder="IMEI"
              value={addForm.imei}
              onChange={(e) => setAddForm({ ...addForm, imei: e.target.value })}
              className="bg-gray-600 text-white text-sm rounded px-2 py-1 w-full font-mono"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Колір</label>
              <input
                type="color"
                value={addForm.color}
                onChange={(e) => setAddForm({ ...addForm, color: e.target.value })}
                className="w-8 h-6 rounded cursor-pointer bg-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={addTracker} className="flex-1 bg-blue-600 hover:bg-blue-500 text-sm py-1 rounded transition">Зберегти</button>
              <button onClick={() => setAdding(false)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-sm py-1 rounded transition">Скасувати</button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {trackers.map((t) => (
            <div key={t._id} className="bg-gray-700 rounded-lg p-3">
              {editId === t._id ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="bg-gray-600 text-white text-sm rounded px-2 py-1 w-full"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Колір</label>
                    <input
                      type="color"
                      value={editForm.color}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                      className="w-8 h-6 rounded cursor-pointer bg-transparent"
                    />
                    <label className="text-xs text-gray-400 ml-auto">Активний</label>
                    <input
                      type="checkbox"
                      checked={editForm.active}
                      onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(t._id)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-xs py-1 rounded transition">Зберегти</button>
                    <button onClick={() => setEditId(null)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-xs py-1 rounded transition">Скасувати</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || "#3b82f6" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{t.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{t.imei}</div>
                  </div>
                  <button onClick={() => startEdit(t)} className="text-gray-400 hover:text-white text-xs transition">✏️</button>
                  <button onClick={() => deleteTracker(t._id)} className="text-gray-400 hover:text-red-400 text-xs transition">🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Зони */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400 uppercase tracking-wider">Зони</label>
          <button
            onClick={() => { setAddingZone(!addingZone); setPickingZone(false); }}
            className="text-xs bg-yellow-600 hover:bg-yellow-500 px-2 py-1 rounded transition"
          >
            + Додати
          </button>
        </div>

        {addingZone && (
          <div className="bg-gray-700 rounded-lg p-3 mb-3 flex flex-col gap-2">
            <input
              placeholder="Назва зони"
              value={zoneForm.name}
              onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
              className="bg-gray-600 text-white text-sm rounded px-2 py-1 w-full"
            />
            <div className="flex gap-1">
              <input
                placeholder="Lat"
                value={zoneForm.lat}
                onChange={(e) => setZoneForm({ ...zoneForm, lat: e.target.value })}
                className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full font-mono"
              />
              <input
                placeholder="Lng"
                value={zoneForm.lng}
                onChange={(e) => setZoneForm({ ...zoneForm, lng: e.target.value })}
                className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full font-mono"
              />
            </div>
            <button
              onClick={() => setPickingZone(true)}
              className={`text-xs py-1 rounded transition ${pickingZone ? "bg-yellow-500 text-black" : "bg-gray-600 hover:bg-gray-500"}`}
            >
              {pickingZone ? "⌛ Клікни на карту..." : "📍 Вибрати на карті"}
            </button>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 flex-shrink-0">Радіус (м)</label>
              <input
                type="number"
                value={zoneForm.radius}
                onChange={(e) => setZoneForm({ ...zoneForm, radius: e.target.value })}
                className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Колір</label>
              <input
                type="color"
                value={zoneForm.color}
                onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })}
                className="w-8 h-6 rounded cursor-pointer bg-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={saveZone} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-sm py-1 rounded transition">Зберегти</button>
              <button onClick={() => { setAddingZone(false); setPickingZone(false); }} className="flex-1 bg-gray-600 hover:bg-gray-500 text-sm py-1 rounded transition">Скасувати</button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {zones.map((z) => (
            <div key={z._id} className="bg-gray-700 rounded-lg p-3">
              {zoneEditId === z._id ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={zoneEditForm.name}
                    onChange={(e) => setZoneEditForm({ ...zoneEditForm, name: e.target.value })}
                    className="bg-gray-600 text-white text-sm rounded px-2 py-1 w-full"
                  />
                  <div className="flex gap-1">
                    <input
                      placeholder="Lat"
                      value={zoneEditForm.lat}
                      onChange={(e) => setZoneEditForm({ ...zoneEditForm, lat: e.target.value })}
                      className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full font-mono"
                    />
                    <input
                      placeholder="Lng"
                      value={zoneEditForm.lng}
                      onChange={(e) => setZoneEditForm({ ...zoneEditForm, lng: e.target.value })}
                      className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Радіус (м)</label>
                    <input
                      type="number"
                      value={zoneEditForm.radius}
                      onChange={(e) => setZoneEditForm({ ...zoneEditForm, radius: e.target.value })}
                      className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Колір</label>
                    <input
                      type="color"
                      value={zoneEditForm.color}
                      onChange={(e) => setZoneEditForm({ ...zoneEditForm, color: e.target.value })}
                      className="w-8 h-6 rounded cursor-pointer bg-transparent"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveZoneEdit(z._id)} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-xs py-1 rounded">Зберегти</button>
                    <button onClick={() => setZoneEditId(null)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-xs py-1 rounded">Скасувати</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{z.name}</div>
                    <div className="text-xs text-gray-400">{z.radius} м</div>
                  </div>
                  <button onClick={() => { setZoneEditId(z._id); setZoneEditForm({ name: z.name, lat: z.lat, lng: z.lng, radius: z.radius, color: z.color }); }} className="text-gray-400 hover:text-white text-xs">✏️</button>
                  <button onClick={() => deleteZone(z._id)} className="text-gray-400 hover:text-red-400 text-xs">🗑</button>
                </div>
              )}
            </div>
          ))}
          {zones.length === 0 && (
            <div className="text-xs text-gray-500 text-center py-2">Зон немає</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Головний компонент ─────────────────────────────────────
export default function MapPage() {
  const [trackers, setTrackers] = useState([]);
  const [selectedImei, setSelectedImei] = useState(null);
  const [latest, setLatest] = useState({});
  const [track, setTrack] = useState([]);
  const logout = useAuthStore((s) => s.logout);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [activeTab, setActiveTab] = useState(null); // null | 'tracking' | 'settings'
  const [zones, setZones] = useState([]);
  const [pickingZone, setPickingZone] = useState(false);
  const [pendingZoneCoord, setPendingZoneCoord] = useState(null);
  const [me, setMe] = useState(null);

  function loadTrackers() {
    api.getTrackers().then(setTrackers).catch(console.error);
  }

  function loadZones() {
    api.getZones().then(setZones).catch(console.error);
  }

  useEffect(() => { loadTrackers(); }, []);
  useEffect(() => { loadZones(); }, []);
  useEffect(() => { api.getMe().then(setMe).catch(console.error); }, []);

  useEffect(() => {
    api.getLatest().then((data) => {
      const map = {};
      data.forEach(({ tracker, log }) => { if (log) map[tracker.imei] = log; });
      setLatest(map);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedImei) return setTrack([]);
    const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
    api.getLogs({ imei: selectedImei, from: from.toISOString(), to: to.toISOString(), limit: 2000 })
      .then((logs) => setTrack(logs.map((l) => [l.latitude, l.longitude]).reverse()))
      .catch(console.error);
  }, [selectedImei, dateFrom, dateTo]);

  useEffect(() => {
    const socket = io();
    socket.on("location", (log) => setLatest((prev) => ({ ...prev, [log.imei]: log })));
    return () => socket.disconnect();
  }, []);

  function handleTabClick(tab) {
    setActiveTab(prev => prev === tab ? null : tab);
  }

  function handleMapClick(latlng) {
    if (!pickingZone) return;
    setPendingZoneCoord(latlng);
    setPickingZone(false);
  }

  const selectedTracker = trackers.find((t) => t.imei === selectedImei);
  const mostRecentLog = Object.values(latest).sort(
    (a, b) => new Date(b.deviceTime) - new Date(a.deviceTime)
  )[0];
  const mapCenter = selectedImei && latest[selectedImei]
    ? [latest[selectedImei].latitude, latest[selectedImei].longitude]
    : mostRecentLog
    ? [mostRecentLog.latitude, mostRecentLog.longitude]
    : CENTER;

  const TABS = [
    { id: "tracking", label: "Трекінг", icon: <IconMap /> },
    { id: "settings", label: "Налаштування", icon: <IconSettings /> },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-white">

      {/* Вузька панель з іконками */}
      <div className="flex flex-col items-center bg-gray-800 py-4 gap-1 w-14 flex-shrink-0">
        <div className="text-lg font-bold mb-4">🏠</div>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            title={tab.label}
            className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg transition text-xs gap-0.5 ${
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {tab.icon}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={logout}
          title="Вийти"
          className="text-gray-400 hover:text-white transition w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Панель що розкривається */}
      {activeTab && (
        <div className="w-64 bg-gray-800 border-l border-gray-700 flex-shrink-0 overflow-hidden">
          {activeTab === "tracking" && (
            <TrackingPanel
              trackers={trackers}
              latest={latest}
              selectedImei={selectedImei}
              onSelect={setSelectedImei}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFrom={setDateFrom}
              onDateTo={setDateTo}
            />
          )}
          {activeTab === "settings" && (
            <SettingsPanel
              trackers={trackers}
              onTrackersChange={loadTrackers}
              zones={zones}
              onZonesChange={loadZones}
              pickingZone={pickingZone}
              setPickingZone={setPickingZone}
              pendingZoneCoord={pendingZoneCoord}
              clearPendingCoord={() => setPendingZoneCoord(null)}
              me={me}
            />
          )}
        </div>
      )}

      {/* Карта */}
      <div className="flex-1">
        <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%", cursor: pickingZone ? "crosshair" : "" }}>
          <MapFlyTo center={mapCenter} />
          <MapClickHandler onMapClick={handleMapClick} />
          <TileLayer
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Зони */}
          {zones.map((z) => (
            <Circle
              key={z._id}
              center={[z.lat, z.lng]}
              radius={z.radius}
              pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.1, weight: 2 }}
            >
              <Popup>{z.name}<br />{z.radius} м</Popup>
            </Circle>
          ))}
          {trackers.map((t) => {
            const pos = latest[t.imei];
            if (!pos) return null;
            return (
              <Marker key={t.imei} position={[pos.latitude, pos.longitude]}>
                <Popup>
                  <strong>{t.name}</strong><br />
                  {pos.speed.toFixed(0)} км/г<br />
                  {new Date(pos.deviceTime).toLocaleString("uk")}
                </Popup>
              </Marker>
            );
          })}
          {track.length > 1 && (
            <Polyline
              positions={track}
              color={selectedTracker?.color || "#3b82f6"}
              weight={3}
              opacity={0.8}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
