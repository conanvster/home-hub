import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import { io } from "socket.io-client";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { IS_LOCAL } from "../config";
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
  useEffect(() => { if (center) map.flyTo(center, map.getZoom()); }, [center]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick && onMapClick(e.latlng) });
  return null;
}

// ── Хедер ─────────────────────────────────────────────────────
function AppHeader({ activeTab, onTabChange, isAdmin, logout }) {
  const tabs = [
    { id: "tracking", label: "Трекінг" },
    { id: "settings", label: "Налаштування" },
    ...(IS_LOCAL ? [{ id: "admin", label: "Адмін" }] : []),
  ];

  return (
    <header className="flex items-center bg-gray-800 border-b border-gray-700 px-4 h-12 flex-shrink-0">
      <span className="font-bold text-white mr-6 text-sm whitespace-nowrap">🏠 Home Hub</span>
      <nav className="flex flex-1 h-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 h-full text-sm border-b-2 transition ${
              activeTab === tab.id
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
        {!IS_LOCAL && isAdmin && (
          <a
            href="/admin"
            className="px-4 h-full text-sm border-b-2 border-transparent text-gray-400 hover:text-white flex items-center"
          >
            Адмін
          </a>
        )}
      </nav>
      {!IS_LOCAL && (
        <button
          onClick={logout}
          title="Вийти"
          className="text-gray-400 hover:text-white text-sm px-3 transition whitespace-nowrap"
        >
          Вийти
        </button>
      )}
    </header>
  );
}

// ── Адмін вкладка (local): Синхронізація ─────────────────────
function LocalSyncPanel() {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const load = useCallback(async () => {
    try { setStatus(await api.getSyncStatus()); } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function triggerSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await api.triggerSync();
      setSyncResult(r);
      await load();
    } catch (err) {
      setSyncResult({ error: err.message });
    } finally {
      setSyncing(false);
    }
  }

  function formatUptime(s) {
    if (!s) return "—";
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return [h && `${h}г`, m && `${m}хв`, `${sec}с`].filter(Boolean).join(" ");
  }

  return (
    <div className="max-w-xl">
      {status ? (
        <div className="bg-gray-800 rounded-xl p-5 space-y-3 mb-4">
          {[
            ["Статус", status.status === "ok" ? "✅ Онлайн" : "❌ Помилка"],
            ["Остання синхронізація", status.lastSync ? new Date(status.lastSync).toLocaleString("uk-UA") : "—"],
            ["Всього синхронізовано", status.totalSynced?.toLocaleString("uk-UA") ?? "—"],
            ["Кількість синхронізацій", status.syncCount ?? "—"],
            ["Uptime", formatUptime(status.uptime)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center border-b border-gray-700 pb-3 last:border-0 last:pb-0">
              <span className="text-gray-400 text-sm">{label}</span>
              <span className="text-sm font-medium text-white">{value}</span>
            </div>
          ))}
          {status.lastError && (
            <div className="text-red-400 text-xs pt-1">Помилка: {status.lastError}</div>
          )}
        </div>
      ) : (
        <div className="text-gray-400 text-sm mb-4">Завантаження...</div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={triggerSync}
          disabled={syncing}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          {syncing ? "Синхронізація..." : "↻ Синхронізувати зараз"}
        </button>
        {syncResult && !syncResult.error && (
          <span className="text-green-400 text-sm">+{syncResult.inserted} записів ({syncResult.duration} мс)</span>
        )}
        {syncResult?.error && (
          <span className="text-red-400 text-sm">{syncResult.error}</span>
        )}
      </div>
      <p className="text-gray-600 text-xs mt-3">Автооновлення кожні 10 секунд</p>
    </div>
  );
}

// ── Адмін вкладка (local): Telegram лог ──────────────────────
function LocalTelegramPanel() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try { setData(await api.getLocalTelegram({ page, direction })); }
    finally { setLoading(false); }
  }

  useEffect(() => { setPage(1); }, [direction]);
  useEffect(() => { load(); }, [page, direction]);

  const STATUS_COLORS = {
    pending: "text-yellow-400",
    sent: "text-green-400",
    failed: "text-red-400",
    received: "text-blue-400",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="bg-gray-700 text-white text-xs rounded px-2 py-1"
        >
          <option value="">Всі напрямки</option>
          <option value="in">Вхідні (in)</option>
          <option value="out">Вихідні (out)</option>
        </select>
        {data && <span className="text-gray-400 text-xs">Всього: {data.total}</span>}
        {loading && <span className="text-gray-500 text-xs">Завантаження...</span>}
      </div>

      {data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                  <th className="text-left py-2 px-3">Дата</th>
                  <th className="text-left py-2 px-3">Напрямок</th>
                  <th className="text-left py-2 px-3">Статус</th>
                  <th className="text-left py-2 px-3">Chat ID</th>
                  <th className="text-left py-2 px-3">Текст</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((m) => (
                  <tr key={m._id} className="border-b border-gray-800 hover:bg-gray-800/50 align-top">
                    <td className="py-2 px-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleString("uk-UA")}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-xs ${m.direction === "in" ? "text-blue-400" : "text-purple-400"}`}>
                        {m.direction === "in" ? "← in" : "→ out"}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-xs ${STATUS_COLORS[m.status] || "text-gray-400"}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-400 text-xs font-mono">{m.telegramId}</td>
                    <td className="py-2 px-3 text-gray-200 text-xs max-w-xs break-words">
                      {m.text}
                      {m.error && <div className="text-red-400 text-xs mt-0.5">{m.error}</div>}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-500 text-sm">Немає повідомлень</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {data.pages > 1 && (
            <div className="flex gap-2 items-center text-sm">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40">←</button>
              <span className="text-gray-400">{page} / {data.pages}</span>
              <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40">→</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Адмін вкладка (local): Користувачі ───────────────────────
function LocalUsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLocalUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 text-sm">Завантаження...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
            <th className="text-left py-2 px-3">Email</th>
            <th className="text-left py-2 px-3">Роль</th>
            <th className="text-left py-2 px-3">Telegram</th>
            <th className="text-left py-2 px-3">Реєстрація</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="py-2 px-3 text-white">{u.email}</td>
              <td className="py-2 px-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  u.role === "admin" ? "bg-blue-900 text-blue-300" : "bg-gray-700 text-gray-300"
                }`}>
                  {u.role}
                </span>
              </td>
              <td className="py-2 px-3">
                {u.telegramId
                  ? <span className="text-green-400 text-xs">✓ {u.telegramId}</span>
                  : <span className="text-gray-600 text-xs">—</span>}
              </td>
              <td className="py-2 px-3 text-gray-400 text-xs">
                {new Date(u.createdAt).toLocaleDateString("uk-UA")}
              </td>
            </tr>
          ))}
          {!users.length && (
            <tr><td colSpan={4} className="py-4 text-center text-gray-500 text-sm">Немає користувачів</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Адмін вкладка (local): Резервна копія ────────────────────
function LocalBackupPanel() {
  const [downloading, setDownloading] = useState(false);
  const [pushStatus, setPushStatus] = useState(null);
  const [pushing, setPushing] = useState(false);
  const pollRef = useRef(null);

  async function handleBackup() {
    setDownloading(true);
    try {
      const res = await fetch("/api/backup");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `home-hub-local-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Помилка: " + err.message);
    } finally {
      setDownloading(false);
    }
  }

  async function startPush() {
    if (!confirm("Відновити хмарну базу даних з локальних даних?\n\nВсі поточні дані на хмарі будуть замінені!")) return;
    setPushing(true);
    setPushStatus(null);
    try {
      await api.startPushToCloud();
      // Poll status
      pollRef.current = setInterval(async () => {
        const s = await api.getPushStatus();
        setPushStatus(s);
        if (!s.running) {
          clearInterval(pollRef.current);
          setPushing(false);
        }
      }, 1500);
    } catch (err) {
      setPushStatus({ step: "error", error: err.message });
      setPushing(false);
    }
  }

  useEffect(() => () => clearInterval(pollRef.current), []);

  const pushProgress = pushStatus?.logsTotal > 0
    ? Math.round((pushStatus.logsSent / pushStatus.logsTotal) * 100)
    : null;

  const STEP_LABELS = { meta: "Надсилання метаданих...", logs: "Надсилання логів...", done: "Завершено", error: "Помилка" };

  return (
    <div className="flex flex-col gap-4 max-w-md">
      {/* Локальний бекап */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Резервна копія локальних даних</h3>
        <p className="text-gray-400 text-sm mb-4">
          JSON-файл з усіма колекціями: logs, trackers, zones, users, telegram messages.
        </p>
        <button
          onClick={handleBackup}
          disabled={downloading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
        >
          {downloading ? "Підготовка..." : "⬇ Завантажити бекап"}
        </button>
      </div>

      {/* Відновлення хмари з локального */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Відновити хмару з локального</h3>
        <p className="text-gray-400 text-sm mb-4">
          Надсилає всі локальні дані на хмарний сервер. Використовувати при втраті хмарної бази даних.
        </p>
        <button
          onClick={startPush}
          disabled={pushing}
          className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
        >
          {pushing ? "Відновлення..." : "↑ Відновити хмару"}
        </button>

        {pushStatus && (
          <div className={`mt-4 rounded-lg p-3 text-sm ${
            pushStatus.step === "error" ? "bg-red-900/40 border border-red-700" :
            pushStatus.step === "done" ? "bg-green-900/40 border border-green-700" :
            "bg-gray-700"
          }`}>
            <div className={`font-medium mb-1 ${
              pushStatus.step === "error" ? "text-red-300" :
              pushStatus.step === "done" ? "text-green-400" : "text-white"
            }`}>
              {STEP_LABELS[pushStatus.step] || pushStatus.step}
            </div>
            {pushStatus.step === "logs" && pushStatus.logsTotal > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{pushStatus.logsSent.toLocaleString("uk-UA")} / {pushStatus.logsTotal.toLocaleString("uk-UA")} логів</span>
                  <span>{pushProgress}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pushProgress}%` }} />
                </div>
              </div>
            )}
            {pushStatus.step === "done" && (
              <div className="text-xs text-gray-300">
                {pushStatus.logsTotal.toLocaleString("uk-UA")} логів відновлено •{" "}
                {pushStatus.finishedAt && new Date(pushStatus.finishedAt).toLocaleTimeString("uk-UA")}
              </div>
            )}
            {pushStatus.error && <div className="text-red-300 text-xs mt-1">{pushStatus.error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Адмін вкладка (local) ─────────────────────────────────────
function LocalAdminPanel() {
  const [tab, setTab] = useState("sync");

  const TABS = [
    ["sync", "Синхронізація"],
    ["users", "Користувачі"],
    ["telegram", "Telegram лог"],
    ["backup", "Резервна копія"],
  ];

  return (
    <div className="p-6">
      <div className="flex gap-1 border-b border-gray-700 mb-6">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm border-b-2 transition ${
              tab === id ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "sync" && <LocalSyncPanel />}
      {tab === "users" && <LocalUsersPanel />}
      {tab === "telegram" && <LocalTelegramPanel />}
      {tab === "backup" && <LocalBackupPanel />}
    </div>
  );
}

// ── Панель Трекінг ─────────────────────────────────────────────
function TrackingPanel({ trackers, latest, selectedImei, onSelect, dateFrom, dateTo, onDateFrom, onDateTo }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      <h2 className="font-semibold text-white">Трекінг</h2>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400 uppercase tracking-wider">Діапазон</label>
        <input type="date" value={dateFrom} max={todayStr} onChange={(e) => onDateFrom(e.target.value)}
          className="bg-gray-700 text-white text-xs rounded px-2 py-1" />
        <input type="date" value={dateTo} max={todayStr} onChange={(e) => onDateTo(e.target.value)}
          className="bg-gray-700 text-white text-xs rounded px-2 py-1" />
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
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || "#3b82f6" }} />
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

// ── Telegram секція ────────────────────────────────────────────
function TelegramSection({ me, onMeChange }) {
  const [linkCode, setLinkCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  async function generateCode() {
    setLoading(true);
    try {
      const { code } = await api.generateTelegramLink();
      setLinkCode(code);
    } catch { alert("Помилка генерації коду"); }
    finally { setLoading(false); }
  }

  async function unlink() {
    if (!confirm("Відключити Telegram від акаунту?")) return;
    setUnlinkLoading(true);
    try { await api.unlinkTelegram(); onMeChange(); setLinkCode(null); }
    finally { setUnlinkLoading(false); }
  }

  return (
    <div className="bg-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white text-sm">Telegram</h3>
        <a href="https://t.me/PrivatHomeBaseBot" target="_blank" rel="noreferrer"
          className="text-xs text-blue-400 hover:underline">
          @PrivatHomeBaseBot
        </a>
      </div>
      {me?.telegramId ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <span className="text-green-400 font-medium">Підключено</span>
          </div>
          <button onClick={unlink} disabled={unlinkLoading}
            className="text-xs bg-red-800 hover:bg-red-700 py-1.5 rounded transition disabled:opacity-50">
            {unlinkLoading ? "..." : "Відключити"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-xs text-gray-400">
          <div>
            <div className="text-gray-300 mb-1 font-medium">Варіант A — через email:</div>
            <div className="text-gray-400">Надішліть боту:</div>
            <div className="font-mono text-blue-400 mt-0.5">/register ваш@email.com</div>
            <div className="text-gray-500 mt-0.5">Отримаєте код на email → /confirm КОД</div>
          </div>
          <div className="border-t border-gray-600" />
          <div>
            <div className="text-gray-300 mb-1 font-medium">Варіант B — через сайт:</div>
            {linkCode ? (
              <div className="flex flex-col gap-1">
                <div className="text-gray-400">Надішліть боту:</div>
                <div className="bg-gray-800 rounded px-2 py-1.5 font-mono text-white text-center select-all mt-0.5">
                  /link {linkCode}
                </div>
                <div className="text-gray-500 mt-0.5">Код дійсний 15 хвилин</div>
                <button onClick={generateCode} disabled={loading}
                  className="text-blue-400 hover:text-blue-300 mt-1 disabled:opacity-50">
                  Оновити код
                </button>
              </div>
            ) : (
              <button onClick={generateCode} disabled={loading}
                className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded transition disabled:opacity-50">
                {loading ? "..." : "Згенерувати код"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Панель Налаштування (повноекранна) ─────────────────────────
function SettingsPanel({ trackers, onTrackersChange, zones, onZonesChange, onPickZone, pendingZoneCoord, clearPendingCoord, me, onMeChange }) {
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addForm, setAddForm] = useState({ name: "", imei: "", color: "#3b82f6", active: true });
  const [adding, setAdding] = useState(false);

  const [zoneEditId, setZoneEditId] = useState(null);
  const [zoneEditForm, setZoneEditForm] = useState({});
  const [addingZone, setAddingZone] = useState(false);
  const [zoneForm, setZoneForm] = useState({ name: "", lat: "", lng: "", radius: 500, color: "#f59e0b" });

  useEffect(() => {
    if (pendingZoneCoord) {
      setZoneForm(f => ({ ...f, lat: pendingZoneCoord.lat.toFixed(6), lng: pendingZoneCoord.lng.toFixed(6) }));
      clearPendingCoord();
      setAddingZone(true);
    }
  }, [pendingZoneCoord]);

  async function saveEdit(id) {
    await api.updateTracker(id, editForm); setEditId(null); onTrackersChange();
  }
  async function deleteTracker(id) {
    if (!confirm("Видалити трекер?")) return; await api.deleteTracker(id); onTrackersChange();
  }
  async function addTracker() {
    if (!addForm.name || !addForm.imei) return;
    await api.createTracker(addForm);
    setAddForm({ name: "", imei: "", color: "#3b82f6", active: true }); setAdding(false); onTrackersChange();
  }
  async function saveZone() {
    if (!zoneForm.name || zoneForm.lat === "" || zoneForm.lng === "") return;
    await api.createZone({ ...zoneForm, lat: Number(zoneForm.lat), lng: Number(zoneForm.lng), radius: Number(zoneForm.radius) });
    setZoneForm({ name: "", lat: "", lng: "", radius: 500, color: "#f59e0b" }); setAddingZone(false); onZonesChange();
  }
  async function saveZoneEdit(id) {
    await api.updateZone(id, { ...zoneEditForm, lat: Number(zoneEditForm.lat), lng: Number(zoneEditForm.lng), radius: Number(zoneEditForm.radius) });
    setZoneEditId(null); onZonesChange();
  }
  async function deleteZone(id) {
    if (!confirm("Видалити зону?")) return; await api.deleteZone(id); onZonesChange();
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Колонка 1: Telegram + Трекери */}
        <div className="flex flex-col gap-4">
          {!IS_LOCAL && <TelegramSection me={me} onMeChange={onMeChange} />}

          {/* Трекери */}
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Трекери</h3>
              <button onClick={() => setAdding(!adding)}
                className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded transition">
                + Додати
              </button>
            </div>

            {adding && (
              <div className="bg-gray-700 rounded-lg p-3 mb-3 flex flex-col gap-2">
                <input placeholder="Назва" value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="bg-gray-600 text-white text-sm rounded px-2 py-1.5 w-full" />
                <input placeholder="IMEI" value={addForm.imei}
                  onChange={(e) => setAddForm({ ...addForm, imei: e.target.value })}
                  className="bg-gray-600 text-white text-sm rounded px-2 py-1.5 w-full font-mono" />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">Колір</label>
                  <input type="color" value={addForm.color}
                    onChange={(e) => setAddForm({ ...addForm, color: e.target.value })}
                    className="w-8 h-6 rounded cursor-pointer bg-transparent" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addTracker} className="flex-1 bg-blue-600 hover:bg-blue-500 text-sm py-1.5 rounded">Зберегти</button>
                  <button onClick={() => setAdding(false)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-sm py-1.5 rounded">Скасувати</button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {trackers.map((t) => (
                <div key={t._id} className="bg-gray-700 rounded-lg p-3">
                  {editId === t._id ? (
                    <div className="flex flex-col gap-2">
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="bg-gray-600 text-white text-sm rounded px-2 py-1 w-full" />
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400">Колір</label>
                        <input type="color" value={editForm.color}
                          onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                          className="w-8 h-6 rounded cursor-pointer bg-transparent" />
                        <label className="text-xs text-gray-400 ml-auto">Активний</label>
                        <input type="checkbox" checked={editForm.active}
                          onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(t._id)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-xs py-1 rounded">Зберегти</button>
                        <button onClick={() => setEditId(null)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-xs py-1 rounded">Скасувати</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || "#3b82f6" }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{t.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{t.imei}</div>
                      </div>
                      <button onClick={() => { setEditId(t._id); setEditForm({ name: t.name, color: t.color || "#3b82f6", active: t.active ?? true }); }}
                        className="text-gray-400 hover:text-white text-xs transition">✏️</button>
                      <button onClick={() => deleteTracker(t._id)}
                        className="text-gray-400 hover:text-red-400 text-xs transition">🗑</button>
                    </div>
                  )}
                </div>
              ))}
              {trackers.length === 0 && <div className="text-xs text-gray-500 text-center py-2">Трекерів немає</div>}
            </div>
          </div>
        </div>

        {/* Колонка 2: Зони */}
        <div className="flex flex-col gap-4">
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Геозони</h3>
              <button onClick={() => setAddingZone(!addingZone)}
                className="text-xs bg-yellow-600 hover:bg-yellow-500 px-3 py-1 rounded transition">
                + Додати
              </button>
            </div>

            {addingZone && (
              <div className="bg-gray-700 rounded-lg p-3 mb-3 flex flex-col gap-2">
                <input placeholder="Назва зони" value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  className="bg-gray-600 text-white text-sm rounded px-2 py-1.5 w-full" />
                <div className="flex gap-1">
                  <input placeholder="Lat" value={zoneForm.lat}
                    onChange={(e) => setZoneForm({ ...zoneForm, lat: e.target.value })}
                    className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full font-mono" />
                  <input placeholder="Lng" value={zoneForm.lng}
                    onChange={(e) => setZoneForm({ ...zoneForm, lng: e.target.value })}
                    className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full font-mono" />
                </div>
                <button onClick={onPickZone}
                  className="text-xs bg-gray-600 hover:bg-gray-500 py-1.5 rounded transition">
                  📍 Вибрати на карті
                </button>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 flex-shrink-0">Радіус (м)</label>
                  <input type="number" value={zoneForm.radius}
                    onChange={(e) => setZoneForm({ ...zoneForm, radius: e.target.value })}
                    className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">Колір</label>
                  <input type="color" value={zoneForm.color}
                    onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })}
                    className="w-8 h-6 rounded cursor-pointer bg-transparent" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveZone} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-sm py-1.5 rounded">Зберегти</button>
                  <button onClick={() => setAddingZone(false)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-sm py-1.5 rounded">Скасувати</button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {zones.map((z) => (
                <div key={z._id} className="bg-gray-700 rounded-lg p-3">
                  {zoneEditId === z._id ? (
                    <div className="flex flex-col gap-2">
                      <input value={zoneEditForm.name}
                        onChange={(e) => setZoneEditForm({ ...zoneEditForm, name: e.target.value })}
                        className="bg-gray-600 text-white text-sm rounded px-2 py-1 w-full" />
                      <div className="flex gap-1">
                        <input placeholder="Lat" value={zoneEditForm.lat}
                          onChange={(e) => setZoneEditForm({ ...zoneEditForm, lat: e.target.value })}
                          className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full font-mono" />
                        <input placeholder="Lng" value={zoneEditForm.lng}
                          onChange={(e) => setZoneEditForm({ ...zoneEditForm, lng: e.target.value })}
                          className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full font-mono" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400">Радіус (м)</label>
                        <input type="number" value={zoneEditForm.radius}
                          onChange={(e) => setZoneEditForm({ ...zoneEditForm, radius: e.target.value })}
                          className="bg-gray-600 text-white text-xs rounded px-2 py-1 w-full" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400">Колір</label>
                        <input type="color" value={zoneEditForm.color}
                          onChange={(e) => setZoneEditForm({ ...zoneEditForm, color: e.target.value })}
                          className="w-8 h-6 rounded cursor-pointer bg-transparent" />
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
                      <button onClick={() => { setZoneEditId(z._id); setZoneEditForm({ name: z.name, lat: z.lat, lng: z.lng, radius: z.radius, color: z.color }); }}
                        className="text-gray-400 hover:text-white text-xs">✏️</button>
                      <button onClick={() => deleteZone(z._id)}
                        className="text-gray-400 hover:text-red-400 text-xs">🗑</button>
                    </div>
                  )}
                </div>
              ))}
              {zones.length === 0 && <div className="text-xs text-gray-500 text-center py-2">Зон немає</div>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Головний компонент ─────────────────────────────────────────
export default function MapPage() {
  const [trackers, setTrackers] = useState([]);
  const [selectedImei, setSelectedImei] = useState(null);
  const [latest, setLatest] = useState({});
  const [track, setTrack] = useState([]);
  const [zones, setZones] = useState([]);
  const [pendingZoneCoord, setPendingZoneCoord] = useState(null);
  const [pickingZone, setPickingZone] = useState(false);
  const [me, setMe] = useState(null);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "tracking");
  const logout = useAuthStore((s) => s.logout);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  function loadTrackers() { api.getTrackers().then(setTrackers).catch(console.error); }
  function loadZones() { api.getZones().then(setZones).catch(console.error); }
  function loadMe() { api.getMe().then(setMe).catch(console.error); }

  useEffect(() => { loadTrackers(); }, []);
  useEffect(() => { loadZones(); }, []);
  useEffect(() => { if (!IS_LOCAL) loadMe(); }, []);

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
    if (IS_LOCAL) return;
    const socket = io();
    socket.on("location", (log) => setLatest((prev) => ({ ...prev, [log.imei]: log })));
    return () => socket.disconnect();
  }, []);

  function handlePickZone() {
    setPickingZone(true);
    setActiveTab("tracking");
  }

  function handleMapClick(latlng) {
    if (!pickingZone) return;
    setPendingZoneCoord(latlng);
    setPickingZone(false);
    setActiveTab("settings");
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

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <AppHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={!IS_LOCAL && me?.role === "admin"}
        logout={logout}
      />

      <div className="flex-1 overflow-hidden">
        {/* Трекінг: ліва панель + карта */}
        {activeTab === "tracking" && (
          <div className="flex h-full">
            <div className="w-72 bg-gray-800 border-r border-gray-700 flex-shrink-0 overflow-hidden">
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
            </div>
            <div className="flex-1">
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: "100%", width: "100%", cursor: pickingZone ? "crosshair" : "" }}
              >
                <MapFlyTo center={mapCenter} />
                <MapClickHandler onMapClick={handleMapClick} />
                <TileLayer
                  attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {zones.map((z) => (
                  <Circle key={z._id} center={[z.lat, z.lng]} radius={z.radius}
                    pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.1, weight: 2 }}>
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
                  <Polyline positions={track} color={selectedTracker?.color || "#3b82f6"} weight={3} opacity={0.8} />
                )}
                {pickingZone && (
                  <div style={{
                    position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
                    zIndex: 1000, background: "rgba(0,0,0,0.75)", color: "white",
                    padding: "6px 14px", borderRadius: 8, fontSize: 13, pointerEvents: "none"
                  }}>
                    📍 Клікни на карті щоб вибрати центр зони
                  </div>
                )}
              </MapContainer>
            </div>
          </div>
        )}

        {/* Адмін (local): синхронізація */}
        {activeTab === "admin" && IS_LOCAL && (
          <div className="h-full overflow-y-auto bg-gray-900">
            <LocalAdminPanel />
          </div>
        )}

        {/* Налаштування: повноекранний */}
        {activeTab === "settings" && (
          <div className="h-full overflow-y-auto">
            <SettingsPanel
              trackers={trackers}
              onTrackersChange={loadTrackers}
              zones={zones}
              onZonesChange={loadZones}
              onPickZone={handlePickZone}
              pendingZoneCoord={pendingZoneCoord}
              clearPendingCoord={() => setPendingZoneCoord(null)}
              me={me}
              onMeChange={loadMe}
            />
          </div>
        )}
      </div>
    </div>
  );
}
