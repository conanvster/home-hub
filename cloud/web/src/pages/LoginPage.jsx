import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(email, password);
      login(data.token, data.user);
      navigate("/");
    } catch (err) {
      if (err.status === 401) setError("Невірний email або пароль");
      else if (err.status === 502 || err.status === 503) setError("Сервер тимчасово недоступний. Спробуйте пізніше.");
      else setError(`Помилка: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-xl w-full max-w-sm">
        <h1 className="text-white text-2xl font-bold text-center">🏠 Home Hub</h1>
        <p className="text-gray-500 text-sm text-center mb-6">Вхід до системи</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <div className="flex flex-col gap-1">
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <div className="flex justify-end">
              <a href="/forgot-password" className="text-xs text-blue-400 hover:underline">Забули пароль?</a>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Вхід..." : "Увійти"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <a href="/register" className="text-gray-400 hover:text-white">Немає акаунту? Зареєструватись</a>
        </div>
      </div>
    </div>
  );
}
