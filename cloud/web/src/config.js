// IS_LOCAL = true коли білд/dev запущено з VITE_MODE=local
export const IS_LOCAL = import.meta.env.VITE_MODE === "local";
export const VERSION = `${IS_LOCAL ? "local" : "cloud"}@${import.meta.env.VITE_GIT_COMMIT || "dev"}`;
