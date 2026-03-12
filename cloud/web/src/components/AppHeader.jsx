import { useState, useEffect } from "react";
import { IS_LOCAL, VERSION, IMMICH_URL, FILEBROWSER_URL, HA_URL } from "../config";
import { useAuthStore } from "../store/useAuthStore";
import { api } from "../services/api";
import { useFontScale } from "../hooks/useFontScale";

function FontScaleSwitcher() {
  const [scale, setScale] = useFontScale();
  return (
    <div className="flex items-center gap-0.5 mx-1 sm:mx-2">
      {[
        { v: 1,   label: "A",   title: "Нормальний шрифт" },
        { v: 1.5, label: "A+",  title: "Середній шрифт" },
        { v: 2,   label: "A++", title: "Великий шрифт" },
      ].map(({ v, label, title }) => (
        <button
          key={v}
          title={title}
          onClick={() => setScale(v)}
          style={{ fontSize: "11px", lineHeight: 1 }}
          className={`px-1.5 py-1 rounded transition whitespace-nowrap ${
            scale === v
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function VerificationBanner() {
  const [visible, setVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api.getMe()
      .then(me => { if (!me.emailVerified) setVisible(true); })
      .catch(() => {});
  }, []);

  if (!visible) return null;

  async function resend() {
    setSending(true);
    try {
      await api.resendVerification();
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-yellow-900/80 border-b border-yellow-700 px-4 py-2 flex items-center justify-between text-sm">
      <span className="text-yellow-200">
        ⚠️ Підтвердіть email — у вас є 12 годин з моменту реєстрації
      </span>
      <div className="flex items-center gap-3">
        {sent
          ? <span className="text-green-400 text-xs">✓ Лист надіслано</span>
          : <button onClick={resend} disabled={sending} className="text-yellow-300 hover:text-yellow-100 text-xs underline disabled:opacity-50">
              {sending ? "Надсилання..." : "Надіслати повторно"}
            </button>
        }
        <button onClick={() => setVisible(false)} className="text-yellow-500 hover:text-yellow-300 text-xs">✕</button>
      </div>
    </div>
  );
}

/**
 * Єдиний хедер для всього додатку.
 *
 * Props:
 *   activePage   — "kanban" | "map" | "ha" | "chat" | "admin" | "profile"
 *   isAdmin      — bool  (cloud: з store; local: з store)
 *   constrained  — bool — обмежити ширину до 1024px
 */
export default function AppHeader({ activePage, constrained = false }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = user?.role === "admin";

  const navLink = (isActive) =>
    `px-2 sm:px-4 h-full text-xs sm:text-sm border-b-2 flex items-center transition whitespace-nowrap ${
      isActive ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-white"
    }`;
  const inactiveLink = `px-2 sm:px-4 h-full text-xs sm:text-sm border-b-2 border-transparent flex items-center transition text-gray-400 hover:text-white`;
  const innerCls = constrained
    ? "max-w-[1024px] mx-auto w-full flex items-center h-12 px-3 sm:px-4"
    : "flex items-center h-12 px-3 sm:px-4 w-full";

  // ── Локальний режим ──────────────────────────────────────────
  if (IS_LOCAL) {
    return (
      <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className={innerCls}>
          <a href="/kanban" className="font-bold text-white mr-3 sm:mr-6 text-sm whitespace-nowrap">🏠 <span className="hidden sm:inline">Home Hub</span></a>
          <nav className="flex flex-1 h-full">
            <a href="/kanban" className={navLink(activePage === "kanban")}>Канбан</a>
            <a href="/map"    className={navLink(activePage === "map")}>Трекінг</a>
            <a href="/chat"   className={navLink(activePage === "chat")}>💬 Чат</a>
            {isAdmin && <a href="/admin" className={navLink(activePage === "admin")}>Адмін</a>}
          </nav>
          <a href="/ha" className={navLink(activePage === "ha")}>🏡 <span className="hidden sm:inline">Дім</span></a>
          <a href={IMMICH_URL} target="_blank" rel="noreferrer" className={inactiveLink + " hidden md:flex"}>🖼 Фото</a>
          <a href={FILEBROWSER_URL} target="_blank" rel="noreferrer" className={inactiveLink + " hidden md:flex"}>📁 Файли</a>
          <a href={HA_URL} target="_blank" rel="noreferrer" className={inactiveLink + " hidden md:flex"}>⚙️ HA</a>
          <span className="text-gray-600 text-xs font-mono mx-2 whitespace-nowrap hidden md:inline">{VERSION}</span>
          <FontScaleSwitcher />
          <button onClick={logout} className="text-gray-400 hover:text-white text-xs sm:text-sm px-2 sm:px-3 transition whitespace-nowrap">
            Вийти
          </button>
        </div>
      </header>
    );
  }

  // ── Хмарний режим ────────────────────────────────────────────
  return (
    <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
      <VerificationBanner />
      <div className={innerCls}>
        <a href="/" className="font-bold text-white mr-3 sm:mr-6 text-sm whitespace-nowrap">🏠 Home Hub</a>
        <nav className="flex flex-1 h-full">
          <a href="/"        className={navLink(activePage === "map")}>Трекінг</a>
          <a href="/kanban"  className={navLink(activePage === "kanban")}>📋 Канбан</a>
          <a href="/chat"    className={navLink(activePage === "chat")}>💬 Чат</a>
          {isAdmin && (
            <a href="/admin" className={navLink(activePage === "admin")}>Адмін</a>
          )}
          <a href="/profile" className={navLink(activePage === "profile")}>👤 Профіль</a>
        </nav>
        <span className="text-gray-600 text-xs font-mono mx-2 whitespace-nowrap hidden md:inline">{VERSION}</span>
        <FontScaleSwitcher />
        <button onClick={logout} className="text-gray-400 hover:text-white text-xs sm:text-sm px-2 sm:px-3 transition whitespace-nowrap">
          Вийти
        </button>
      </div>
    </header>
  );
}
