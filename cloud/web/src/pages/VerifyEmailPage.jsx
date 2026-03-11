import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../services/api";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Токен відсутній");
      return;
    }
    api.verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setError(err.message);
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
        {status === "loading" && (
          <p className="text-gray-400">Підтвердження...</p>
        )}
        {status === "success" && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-white text-xl font-bold mb-2">Email підтверджено!</h1>
            <p className="text-gray-400 mb-6">Ваш акаунт повністю активований.</p>
            <Link to="/" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg transition inline-block">
              Перейти на сайт
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-white text-xl font-bold mb-2">Помилка підтвердження</h1>
            <p className="text-red-400 mb-6">{error}</p>
            <Link to="/" className="text-blue-400 hover:text-blue-300 transition">
              На головну
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
