import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== password2) return setError("Паролі не співпадають");
    setLoading(true);
    try {
      const data = await api.register(email, password);
      login(data.token, data.user);
      navigate("/");
    } catch (err) {
      const msg = err.message.includes("409") ? "Цей email вже зареєстровано" : "Помилка реєстрації";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-xl w-full max-w-sm">
        <h1 className="text-white text-2xl font-bold mb-6 text-center">Реєстрація</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Пароль (мін. 6 символів)"
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
            {loading ? "Реєстрація..." : "Зареєструватись"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <a href="/login" className="text-gray-400 hover:text-white">Вже є акаунт? Увійти</a>
        </div>
      </div>
    </div>
  );
}
