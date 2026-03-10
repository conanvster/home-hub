import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

const BASE = "/api";

export default function InvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [info, setInfo] = useState(null);       // { email, role }
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { setError("Токен відсутній"); setLoading(false); return; }
    fetch(`${BASE}/auth/accept-invite/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setInfo(data);
      })
      .catch(() => setError("Помилка мережі"))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 6) { setError("Пароль мінімум 6 символів"); return; }
    if (password !== confirm) { setError("Паролі не співпадають"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/auth/accept-invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Помилка"); return; }
      login(data.token, data.user);
      navigate("/", { replace: true });
    } catch {
      setError("Помилка мережі");
    } finally {
      setSaving(false);
    }
  }

  const roleLabel = { admin: "👑 Адмін", member: "👨‍👩‍👧 Член сім'ї", viewer: "👁️ Перегляд" };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md border border-gray-700">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">🏠 Home Hub</h1>
        <p className="text-gray-400 text-sm text-center mb-6">Прийняти запрошення</p>

        {loading && <p className="text-gray-400 text-center">Перевірка посилання...</p>}

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {info && !error && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="bg-gray-700/50 rounded-xl p-4 flex flex-col gap-1">
              <p className="text-gray-400 text-xs">Email</p>
              <p className="text-white font-medium">{info.email}</p>
              <p className="text-gray-400 text-xs mt-1">Роль</p>
              <p className="text-white">{roleLabel[info.role] || info.role}</p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Мінімум 6 символів"
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs">Підтвердіть пароль</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Повторіть пароль"
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition"
            >
              {saving ? "Збереження..." : "Встановити пароль і увійти"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
