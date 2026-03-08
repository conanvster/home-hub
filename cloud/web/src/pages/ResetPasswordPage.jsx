import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== password2) return setError("Паролі не співпадають");
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.message.includes("400") ? "Посилання недійсне або прострочене" : "Помилка. Спробуйте пізніше.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl w-full max-w-sm text-center">
          <h1 className="text-white text-2xl font-bold">🏠 Home Hub</h1>
          <p className="text-gray-500 text-sm mb-4">Новий пароль</p>
          <p className="text-red-400 text-sm">Недійсне посилання для скидання паролю.</p>
          <a href="/forgot-password" className="mt-4 inline-block text-blue-400 hover:underline text-sm">Запросити нове</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-xl w-full max-w-sm">
        <h1 className="text-white text-2xl font-bold text-center">🏠 Home Hub</h1>
        <p className="text-gray-500 text-sm text-center mb-6">Новий пароль</p>
        {done ? (
          <p className="text-green-400 text-center">Пароль змінено. Перенаправлення...</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Новий пароль (мін. 6 символів)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="password"
              placeholder="Повторіть пароль"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Збереження..." : "Змінити пароль"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
