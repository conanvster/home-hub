import { IS_LOCAL, VERSION } from "../config";

/**
 * Єдиний хедер для всього додатку.
 *
 * Local-режим: вся навігація — URL-посилання (/kanban, /map, /map?tab=settings, /map?tab=admin)
 * Cloud-режим: Трекінг/Налаштування — внутрішні кнопки (onTabChange), Адмін — посилання
 *
 * Props:
 *   activePage   — "kanban" | "map" | "admin"
 *   activeTab    — "tracking" | "settings" | "admin"  (тільки для map)
 *   onTabChange  — fn(tab)  (тільки cloud map)
 *   isAdmin      — bool
 *   logout       — fn  (тільки cloud)
 */
export default function AppHeader({ activePage, activeTab, onTabChange, isAdmin, logout }) {
  const active = (cls) => `px-4 h-full text-sm border-b-2 flex items-center transition ${cls}`;
  const inactiveCls = "border-transparent text-gray-400 hover:text-white";
  const activeCls   = "border-blue-500 text-white";

  // ── Локальний режим ──────────────────────────────────────────
  if (IS_LOCAL) {
    const items = [
      { label: "Канбан",        href: "/kanban",              tabKey: null },
      { label: "Трекінг",       href: "/map",                 tabKey: "tracking" },
      { label: "Налаштування",  href: "/map?tab=settings",    tabKey: "settings" },
      { label: "Адмін",         href: "/map?tab=admin",       tabKey: "admin" },
    ];

    function isActive({ href, tabKey }) {
      if (activePage === "kanban") return href === "/kanban";
      if (activePage === "map") return tabKey ? activeTab === tabKey : false;
      return false;
    }

    return (
      <header className="flex items-center bg-gray-800 border-b border-gray-700 px-4 h-12 flex-shrink-0">
        <a href="/kanban" className="font-bold text-white mr-6 text-sm whitespace-nowrap">🏠 Home Hub</a>
        <nav className="flex flex-1 h-full">
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={active(isActive(item) ? activeCls : inactiveCls)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <span className="text-gray-600 text-xs font-mono mx-3 whitespace-nowrap hidden sm:inline">{VERSION}</span>
      </header>
    );
  }

  // ── Хмарний режим ────────────────────────────────────────────
  const cloudTabs = [
    { id: "tracking",  label: "Трекінг" },
    { id: "settings",  label: "Налаштування" },
  ];

  return (
    <header className="flex items-center bg-gray-800 border-b border-gray-700 px-4 h-12 flex-shrink-0">
      <span className="font-bold text-white mr-6 text-sm whitespace-nowrap">🏠 Home Hub</span>
      <nav className="flex flex-1 h-full">
        {activePage === "map" ? (
          // На MapPage — таби як кнопки
          cloudTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={active(activeTab === tab.id ? activeCls : inactiveCls)}
            >
              {tab.label}
            </button>
          ))
        ) : (
          // На інших сторінках — посилання назад
          cloudTabs.map((tab) => (
            <a
              key={tab.id}
              href={tab.id === "settings" ? "/?tab=settings" : "/"}
              className={active(inactiveCls)}
            >
              {tab.label}
            </a>
          ))
        )}
        {isAdmin && (
          <a
            href="/admin"
            className={active(activePage === "admin" ? activeCls : inactiveCls)}
          >
            Адмін
          </a>
        )}
      </nav>
      <span className="text-gray-600 text-xs font-mono mx-3 whitespace-nowrap hidden sm:inline">{VERSION}</span>
      <button
        onClick={logout}
        className="text-gray-400 hover:text-white text-sm px-3 transition whitespace-nowrap"
      >
        Вийти
      </button>
    </header>
  );
}
