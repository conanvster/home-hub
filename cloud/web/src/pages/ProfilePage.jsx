import { useState, useEffect } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import AppHeader from "../components/AppHeader";

function ChangePasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (next !== confirm) { setMsg({ ok: false, text: "Паролі не співпадають" }); return; }
    if (next.length < 6) { setMsg({ ok: false, text: "Мінімум 6 символів" }); return; }
    setSaving(true);
    setMsg(null);
    try {
      await api.changePassword(current, next);
      setMsg({ ok: true, text: "✅ Пароль змінено" });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-4">🔐 Змінити пароль</h3>
      <form onSubmit={submit} className="flex flex-col gap-3 max-w-sm">
        <div className="flex flex-col gap-1">
          <label className="text-gray-400 text-xs">Поточний пароль</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-gray-400 text-xs">Новий пароль</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
            placeholder="Мінімум 6 символів"
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-gray-400 text-xs">Підтвердити новий пароль</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500" required />
        </div>
        {msg && (
          <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>
        )}
        <button type="submit" disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition">
          {saving ? "Збереження..." : "Змінити пароль"}
        </button>
      </form>
    </div>
  );
}

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
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">📱 Telegram бот</h3>
        <a href="https://t.me/PrivatHomeBaseBot" target="_blank" rel="noreferrer"
          className="text-xs text-blue-400 hover:underline">@PrivatHomeBaseBot</a>
      </div>

      {me?.telegramId ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="text-green-400 font-medium text-sm">Підключено · ID: {me.telegramId}</span>
          </div>
          <p className="text-gray-400 text-xs">Ви отримуватимете сповіщення про геозони та інші події.</p>
          <button onClick={unlink} disabled={unlinkLoading}
            className="self-start text-xs bg-red-800 hover:bg-red-700 px-3 py-1.5 rounded transition disabled:opacity-50">
            {unlinkLoading ? "..." : "Відключити Telegram"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <div className="bg-gray-700/60 rounded-lg p-4 flex flex-col gap-1.5">
            <p className="text-gray-300 font-medium text-xs uppercase tracking-wider mb-1">Варіант A — через Telegram</p>
            <p className="text-gray-400 text-xs">Відкрийте бот і надішліть:</p>
            <code className="text-blue-400 text-sm">/register ваш@email.com</code>
            <p className="text-gray-500 text-xs">Отримаєте код на email → надішліть боту: <code className="text-blue-400">/confirm КОД</code></p>
          </div>

          <div className="bg-gray-700/60 rounded-lg p-4 flex flex-col gap-2">
            <p className="text-gray-300 font-medium text-xs uppercase tracking-wider mb-1">Варіант B — через сайт</p>
            {linkCode ? (
              <>
                <p className="text-gray-400 text-xs">Надішліть боту цю команду:</p>
                <div className="bg-gray-900 rounded-lg px-4 py-3 font-mono text-white text-center select-all text-sm">
                  /link {linkCode}
                </div>
                <p className="text-gray-500 text-xs">Код дійсний 15 хвилин</p>
                <button onClick={generateCode} disabled={loading}
                  className="self-start text-blue-400 hover:text-blue-300 text-xs disabled:opacity-50">
                  Оновити код
                </button>
              </>
            ) : (
              <button onClick={generateCode} disabled={loading}
                className="self-start bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">
                {loading ? "..." : "Згенерувати код"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AppDownloadSection({ apkUrl }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-4">📲 Мобільний додаток</h3>
      <p className="text-gray-400 text-sm mb-4">
        Home Hub для Android — трекінг, Home Assistant, Канбан та чат у вашому телефоні.
      </p>
      {apkUrl ? (
        <div className="flex flex-wrap gap-3">
          <a href={apkUrl} target="_blank" rel="noreferrer"
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition flex items-center gap-2">
            ⬇ Скачати APK (Android)
          </a>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Посилання на APK ще не налаштовано адміністратором.</p>
      )}
      <p className="text-gray-600 text-xs mt-3">
        Для встановлення дозвольте "Невідомі джерела" в налаштуваннях Android
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [me, setMe] = useState(null);
  const [apkUrl, setApkUrl] = useState("");

  useEffect(() => {
    api.getMe().then(setMe).catch(console.error);
    api.getSettings().then((s) => setApkUrl(s.apkUrl || "")).catch(console.error);
  }, []);

  const roleLabel = { admin: "👑 Адмін", member: "👨‍👩‍👧 Member", viewer: "👁️ Viewer" };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <AppHeader activePage="profile" constrained />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1024px] min-w-[800px] mx-auto p-6 flex flex-col gap-6">
          {/* Інфо акаунту */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-white font-semibold">{user?.email}</p>
              <p className="text-gray-400 text-sm">{roleLabel[user?.role] || user?.role}</p>
            </div>
          </div>

          <ChangePasswordSection />
          <TelegramSection me={me} onMeChange={() => api.getMe().then(setMe)} />
          <AppDownloadSection apkUrl={apkUrl} />
        </div>
      </div>
    </div>
  );
}
