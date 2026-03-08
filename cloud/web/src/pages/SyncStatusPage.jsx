import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function SyncStatusPage() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  async function load() {
    try {
      const data = await api.getSyncStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function triggerSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.triggerSync();
      setSyncResult(result);
      await load();
    } catch (err) {
      setSyncResult({ error: err.message });
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">🏠 Home Hub</h1>
          <p className="text-gray-400 text-sm mt-1">Статус синхронізації</p>
        </div>

        <a
          href="/"
          className="inline-block mb-6 text-sm text-blue-400 hover:text-blue-300"
        >
          ← Карта
        </a>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-300 text-sm mb-4">
            Помилка: {error}
          </div>
        )}

        {status ? (
          <div className="bg-gray-800 rounded-xl p-5 space-y-4">
            <Row label="Статус" value={status.status === "ok" ? "✅ Онлайн" : "❌ Помилка"} />
            <Row label="Остання синхронізація" value={status.lastSync ? new Date(status.lastSync).toLocaleString("uk-UA") : "—"} />
            <Row label="Всього синхронізовано" value={status.totalSynced?.toLocaleString("uk-UA") ?? "—"} />
            <Row label="Кількість синхронізацій" value={status.syncCount ?? "—"} />
            {status.lastError && (
              <Row label="Остання помилка" value={status.lastError} className="text-red-400" />
            )}
            <Row label="Uptime" value={formatUptime(status.uptime)} />
          </div>
        ) : !error ? (
          <div className="text-gray-400 text-sm">Завантаження...</div>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {syncing ? "Синхронізація..." : "↻ Синхронізувати зараз"}
          </button>
          {syncResult && !syncResult.error && (
            <span className="text-green-400 text-sm">
              +{syncResult.inserted} записів ({syncResult.duration} мс)
            </span>
          )}
          {syncResult?.error && (
            <span className="text-red-400 text-sm">{syncResult.error}</span>
          )}
        </div>

        <p className="text-gray-600 text-xs mt-3">Автооновлення кожні 10 секунд</p>
      </div>
    </div>
  );
}

function Row({ label, value, className = "text-white" }) {
  return (
    <div className="flex justify-between items-center border-b border-gray-700 pb-3 last:border-0 last:pb-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-sm font-medium ${className}`}>{value}</span>
    </div>
  );
}

function formatUptime(seconds) {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h && `${h}г`, m && `${m}хв`, `${s}с`].filter(Boolean).join(" ");
}
