import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import AppHeader from "../components/AppHeader";

// ── Вкладка: Користувачі ──────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = useAuthStore((s) => s.user);

  async function load() {
    setLoading(true);
    try { setUsers(await api.adminGetUsers()); }
    finally { setLoading(false); }
  }

  async function toggleRole(user) {
    const newRole = user.role === "admin" ? "viewer" : "admin";
    await api.adminUpdateUser(user._id, { role: newRole });
    load();
  }

  async function deleteUser(user) {
    if (!confirm(`Видалити ${user.email}?`)) return;
    await api.adminDeleteUser(user._id);
    load();
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-gray-400 text-sm p-4">Завантаження...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
            <th className="text-left py-2 px-3">Email</th>
            <th className="text-left py-2 px-3">Роль</th>
            <th className="text-left py-2 px-3">Telegram</th>
            <th className="text-left py-2 px-3">Дата реєстрації</th>
            <th className="py-2 px-3"></th>
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
              <td className="py-2 px-3">
                <div className="flex gap-2 justify-end">
                  {u._id !== currentUser?.id && (
                    <>
                      <button
                        onClick={() => toggleRole(u)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                        title={u.role === "admin" ? "Зробити viewer" : "Зробити admin"}
                      >
                        {u.role === "admin" ? "→ viewer" : "→ admin"}
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Видалити
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Вкладка: Telegram лог ─────────────────────────────────────
function TelegramTab() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try { setData(await api.adminGetTelegram({ page, direction, status })); }
    finally { setLoading(false); }
  }

  useEffect(() => { setPage(1); }, [direction, status]);
  useEffect(() => { load(); }, [page, direction, status]);

  const STATUS_COLORS = {
    pending: "text-yellow-400",
    sent: "text-green-400",
    failed: "text-red-400",
    received: "text-blue-400",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap">
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="bg-gray-700 text-white text-xs rounded px-2 py-1"
        >
          <option value="">Всі напрямки</option>
          <option value="in">Вхідні (in)</option>
          <option value="out">Вихідні (out)</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-gray-700 text-white text-xs rounded px-2 py-1"
        >
          <option value="">Всі статуси</option>
          <option value="pending">pending</option>
          <option value="sent">sent</option>
          <option value="failed">failed</option>
          <option value="received">received</option>
        </select>
        {data && (
          <span className="text-gray-400 text-xs self-center">
            Всього: {data.total}
          </span>
        )}
      </div>

      {loading && <div className="text-gray-400 text-sm">Завантаження...</div>}

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
            <div className="flex gap-2 items-center justify-end text-sm">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
              >
                ←
              </button>
              <span className="text-gray-400">{page} / {data.pages}</span>
              <button
                disabled={page === data.pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Вкладка: Резервна копія ───────────────────────────────────
function BackupTab() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const [restoreError, setRestoreError] = useState(null);
  const fileRef = useRef();

  async function handleBackup() {
    setDownloading(true);
    try {
      const token = JSON.parse(localStorage.getItem("auth") || "{}").state?.token;
      const res = await fetch("/api/admin/backup", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `home-hub-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Помилка: " + err.message);
    } finally {
      setDownloading(false);
    }
  }

  async function handleRestore(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm(`Відновити з файлу "${file.name}"? Всі поточні дані будуть замінені!`)) {
      fileRef.current.value = "";
      return;
    }

    setRestoring(true);
    setRestoreResult(null);
    setRestoreError(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const result = await api.adminRestore(backup);
      setRestoreResult(result.restored);
    } catch (err) {
      setRestoreError(err.message);
    } finally {
      setRestoring(false);
      fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      {/* Бекап */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Створити резервну копію</h3>
        <p className="text-gray-400 text-sm mb-4">
          Завантажить JSON файл з усіма колекціями: logs, trackers, zones, users, telegram messages.
        </p>
        <button
          onClick={handleBackup}
          disabled={downloading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
        >
          {downloading ? "Підготовка..." : "⬇ Завантажити бекап"}
        </button>
      </div>

      {/* Відновлення */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-1">Відновити з резервної копії</h3>
        <p className="text-red-400 text-xs mb-3">
          ⚠ Увага: всі поточні дані буде замінено даними з файлу.
        </p>
        <label className={`inline-block bg-yellow-700 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm transition cursor-pointer ${restoring ? "opacity-50 pointer-events-none" : ""}`}>
          {restoring ? "Відновлення..." : "⬆ Вибрати файл бекапу"}
          <input ref={fileRef} type="file" accept=".json" onChange={handleRestore} className="hidden" />
        </label>

        {restoreResult && (
          <div className="mt-4 bg-green-900/40 border border-green-700 rounded-lg p-3">
            <div className="text-green-400 text-sm font-medium mb-2">✅ Відновлено успішно</div>
            {Object.entries(restoreResult).map(([col, count]) => (
              <div key={col} className="flex justify-between text-xs text-gray-300">
                <span>{col}</span>
                <span>{count.toLocaleString("uk-UA")}</span>
              </div>
            ))}
          </div>
        )}

        {restoreError && (
          <div className="mt-4 bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
            {restoreError}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Головна сторінка ──────────────────────────────────────────
const TABS = [
  { id: "users", label: "Користувачі" },
  { id: "telegram", label: "Telegram лог" },
];

export default function AdminPage() {
  const [tab, setTab] = useState("users");
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== "admin") navigate("/");
  }, [user]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <AppHeader activePage="admin" isAdmin={true} logout={logout} />

      {/* Вкладки адмін-контенту */}
      <div className="border-b border-gray-700 px-6 bg-gray-900">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm border-b-2 transition ${
                tab === t.id
                  ? "border-blue-500 text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Контент */}
      <div className="p-6">
        {tab === "users" && <UsersTab />}
        {tab === "telegram" && <TelegramTab />}
      </div>
    </div>
  );
}
