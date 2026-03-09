import AsyncStorage from "@react-native-async-storage/async-storage";

// Базова URL — хмарний сервер (авторизація, трекери, зони)
// Локальний сервер для HA, Kanban — задається в налаштуваннях
export const CLOUD_BASE = "https://mytracking.com.ua/api";

async function getToken() {
  try {
    const raw = await AsyncStorage.getItem("auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

async function getLocalBase() {
  try {
    const raw = await AsyncStorage.getItem("settings");
    const s = raw ? JSON.parse(raw) : {};
    return s.localUrl || "http://192.168.1.34";
  } catch {
    return "http://192.168.1.34";
  }
}

async function request(base, path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    let message;
    try {
      const body = await res.json();
      message = body.error || `HTTP ${res.status}`;
    } catch {
      message = `HTTP ${res.status}`;
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function cloudReq(path, options) {
  return request(CLOUD_BASE, path, options);
}

async function localReq(path, options) {
  const base = await getLocalBase();
  return request(`${base}/api`, path, options);
}

export const api = {
  // ── Auth (cloud) ────────────────────────────────────────────
  login: (email, password) =>
    cloudReq("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  getMe: () => cloudReq("/auth/me"),

  // ── Trackers / logs (cloud) ──────────────────────────────────
  getTrackers: () => cloudReq("/trackers"),
  getLatest: () => cloudReq("/logs/latest"),

  // ── Kanban (local) ───────────────────────────────────────────
  getTasks: () => localReq("/tasks"),
  createTask: (data) => localReq("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id, data) => localReq(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTask: (id) => localReq(`/tasks/${id}`, { method: "DELETE" }),
  getCategories: () => localReq("/tasks/categories"),
  addComment: (taskId, text) =>
    localReq(`/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ text }) }),

  // ── Home Assistant (local) ───────────────────────────────────
  haStates: () => localReq("/ha/states"),
  haService: (domain, service, data) =>
    localReq(`/ha/services/${domain}/${service}`, { method: "POST", body: JSON.stringify(data) }),

  // Camera URL — повертає URL (не робить fetch, використовується в Image)
  haCameraUrl: async (entityId) => {
    const base = await getLocalBase();
    return `${base}/api/ha/camera/${entityId}`;
  },
  haCameraStreamUrl: async (entityId) => {
    const base = await getLocalBase();
    return `${base}/api/ha/camera-stream/${entityId}`;
  },
};
