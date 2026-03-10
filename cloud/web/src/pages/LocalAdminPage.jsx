import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../services/api";
import AppHeader from "../components/AppHeader";

// ── Синхронізація ──────────────────────────────────────────────
function SyncPanel() {
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

// ── Telegram лог ───────────────────────────────────────────────
function TelegramPanel() {
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
    pending: "text-yellow-400", sent: "text-green-400",
    failed: "text-red-400", received: "text-blue-400",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap items-center">
        <select value={direction} onChange={(e) => setDirection(e.target.value)}
          className="bg-gray-700 text-white text-xs rounded px-2 py-1">
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
                      <span className={`text-xs ${STATUS_COLORS[m.status] || "text-gray-400"}`}>{m.status}</span>
                    </td>
                    <td className="py-2 px-3 text-gray-400 text-xs font-mono">{m.telegramId}</td>
                    <td className="py-2 px-3 text-gray-200 text-xs max-w-xs break-words">
                      {m.text}
                      {m.error && <div className="text-red-400 text-xs mt-0.5">{m.error}</div>}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-gray-500 text-sm">Немає повідомлень</td></tr>
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

// ── Користувачі ────────────────────────────────────────────────
function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLocalUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
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
                }`}>{u.role}</span>
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

// ── Резервна копія ─────────────────────────────────────────────
function BackupPanel() {
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
      a.href = url;
      a.download = `home-hub-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
      pollRef.current = setInterval(async () => {
        const s = await api.getPushStatus();
        setPushStatus(s);
        if (!s.running) { clearInterval(pollRef.current); setPushing(false); }
      }, 1500);
    } catch (err) {
      setPushStatus({ step: "error", error: err.message });
      setPushing(false);
    }
  }

  useEffect(() => () => clearInterval(pollRef.current), []);

  const pushProgress = pushStatus?.logsTotal > 0
    ? Math.round((pushStatus.logsSent / pushStatus.logsTotal) * 100) : null;
  const STEP_LABELS = { meta: "Надсилання метаданих...", logs: "Надсилання логів...", done: "Завершено", error: "Помилка" };

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <div className="bg-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Резервна копія локальних даних</h3>
        <p className="text-gray-400 text-sm mb-4">JSON-файл з усіма колекціями: logs, trackers, zones, users, telegram.</p>
        <button onClick={handleBackup} disabled={downloading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">
          {downloading ? "Підготовка..." : "⬇ Завантажити бекап"}
        </button>
      </div>
      <div className="bg-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Відновити хмару з локального</h3>
        <p className="text-gray-400 text-sm mb-4">Надсилає всі локальні дані на хмарний сервер. Використовувати при втраті хмарної БД.</p>
        <button onClick={startPush} disabled={pushing}
          className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">
          {pushing ? "Відновлення..." : "↑ Відновити хмару"}
        </button>
        {pushStatus && (
          <div className={`mt-4 rounded-lg p-3 text-sm ${
            pushStatus.step === "error" ? "bg-red-900/40 border border-red-700" :
            pushStatus.step === "done" ? "bg-green-900/40 border border-green-700" : "bg-gray-700"
          }`}>
            <div className={`font-medium mb-1 ${
              pushStatus.step === "error" ? "text-red-300" :
              pushStatus.step === "done" ? "text-green-400" : "text-white"
            }`}>{STEP_LABELS[pushStatus.step] || pushStatus.step}</div>
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

// ── Головна сторінка ───────────────────────────────────────────
const TABS = [
  { id: "sync",     label: "Синхронізація" },
  { id: "users",    label: "Користувачі" },
  { id: "telegram", label: "Telegram лог" },
  { id: "backup",   label: "Резервна копія" },
];

export default function LocalAdminPage() {
  const [tab, setTab] = useState("sync");

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <AppHeader activePage="admin" constrained />

      <div className="border-b border-gray-700 bg-gray-900">
        <div className="max-w-[1024px] min-w-[800px] mx-auto px-6 flex gap-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm border-b-2 transition ${
                tab === t.id ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-white"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1024px] min-w-[800px] mx-auto">
          {tab === "sync"     && <SyncPanel />}
          {tab === "users"    && <UsersPanel />}
          {tab === "telegram" && <TelegramPanel />}
          {tab === "backup"   && <BackupPanel />}
        </div>
      </div>
    </div>
  );
}
