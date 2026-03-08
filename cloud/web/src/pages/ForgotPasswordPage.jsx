import { useState } from "react";
import { api } from "../services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch {
      setError("Помилка. Спробуйте пізніше.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-xl w-full max-w-sm">
        <h1 className="text-white text-2xl font-bold text-center">🏠 Home Hub</h1>
        <p className="text-gray-500 text-sm text-center mb-2">Відновлення паролю</p>
        {sent ? (
          <div className="text-center">
            <p className="text-green-400 mt-4">Якщо цей email зареєстровано — лист надіслано. Перевірте пошту.</p>
            <a href="/login" className="mt-4 inline-block text-blue-400 hover:underline">Повернутись до входу</a>
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-6 text-center">Введіть ваш email — надішлемо посилання для скидання паролю.</p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
              >
                {loading ? "Надсилання..." : "Надіслати"}
              </button>
            </form>
            <div className="mt-4 text-center text-sm">
              <a href="/login" className="text-gray-400 hover:text-white">Повернутись до входу</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
