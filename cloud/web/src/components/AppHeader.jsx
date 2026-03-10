import { IS_LOCAL, VERSION, IMMICH_URL, FILEBROWSER_URL, HA_URL } from "../config";

/**
 * Єдиний хедер для всього додатку.
 *
 * Props:
 *   activePage   — "kanban" | "map" | "ha" | "chat" | "admin" | "profile"
 *   isAdmin      — bool
 *   logout       — fn  (тільки cloud)
 *   constrained  — bool — обмежити ширину контенту до 1024px (для сторінок з фіксованою шириною)
 */
export default function AppHeader({ activePage, isAdmin, logout, constrained = false }) {
  const active = (cls) => `px-4 h-full text-sm border-b-2 flex items-center transition ${cls}`;
  const inactiveCls = "border-transparent text-gray-400 hover:text-white";
  const activeCls   = "border-blue-500 text-white";
  const innerCls = constrained
    ? "max-w-[1024px] min-w-[800px] mx-auto w-full flex items-center h-12 px-4"
    : "flex items-center h-12 px-4 w-full";

  // ── Локальний режим ──────────────────────────────────────────
  if (IS_LOCAL) {
    return (
      <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className={innerCls}>
          <a href="/kanban" className="font-bold text-white mr-6 text-sm whitespace-nowrap">🏠 Home Hub</a>
          <nav className="flex flex-1 h-full">
            <a href="/kanban" className={active(activePage === "kanban" ? activeCls : inactiveCls)}>Канбан</a>
            <a href="/map" className={active(activePage === "map" ? activeCls : inactiveCls)}>Трекінг</a>
            <a href="/map?tab=admin" className={active(inactiveCls)}>Адмін</a>
          </nav>
          <a href="/ha" className={active(activePage === "ha" ? activeCls : inactiveCls)}>
            🏡 Дім
          </a>
          <a href={IMMICH_URL} target="_blank" rel="noreferrer"
            className={active(inactiveCls + " hidden sm:flex")}>
            🖼 Фото
          </a>
          <a href={FILEBROWSER_URL} target="_blank" rel="noreferrer"
            className={active(inactiveCls + " hidden sm:flex")}>
            📁 Файли
          </a>
          <a href={HA_URL} target="_blank" rel="noreferrer"
            className={active(inactiveCls + " hidden sm:flex")}>
            ⚙️ HA
          </a>
          <span className="text-gray-600 text-xs font-mono mx-3 whitespace-nowrap hidden sm:inline">{VERSION}</span>
        </div>
      </header>
    );
  }

  // ── Хмарний режим ────────────────────────────────────────────
  return (
    <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
      <div className={innerCls}>
        <a href="/" className="font-bold text-white mr-6 text-sm whitespace-nowrap">🏠 Home Hub</a>
        <nav className="flex flex-1 h-full">
          <a href="/" className={active(activePage === "map" ? activeCls : inactiveCls)}>Трекінг</a>
          {isAdmin && (
            <a href="/admin" className={active(activePage === "admin" ? activeCls : inactiveCls)}>Адмін</a>
          )}
          <a href="/chat" className={active(activePage === "chat" ? activeCls : inactiveCls)}>💬 Чат</a>
          <a href="/profile" className={active(activePage === "profile" ? activeCls : inactiveCls)}>👤 Профіль</a>
        </nav>
        <span className="text-gray-600 text-xs font-mono mx-3 whitespace-nowrap hidden sm:inline">{VERSION}</span>
        <button onClick={logout} className="text-gray-400 hover:text-white text-sm px-3 transition whitespace-nowrap">
          Вийти
        </button>
      </div>
    </header>
  );
}
