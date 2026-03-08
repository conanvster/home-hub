// IS_LOCAL = true коли білд/dev запущено з VITE_MODE=local
export const IS_LOCAL = import.meta.env.VITE_MODE === "local";
export const VERSION = `${IS_LOCAL ? "local" : "cloud"}@${import.meta.env.VITE_GIT_COMMIT || "dev"}`;

// Зовнішні сервіси (локальний режим) — використовують поточний хост
const _host = typeof window !== "undefined" ? window.location.hostname : "localhost";
export const IMMICH_URL = `http://${_host}:2283`;
export const FILEBROWSER_URL = `http://${_host}:8080`;
