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
  getLogs: (imei, from, to, limit = 300) => {
    const qs = new URLSearchParams({ imei, ...(from && { from }), ...(to && { to }), limit }).toString();
    return cloudReq(`/logs?${qs}`);
  },

  // ── Kanban (cloud) ───────────────────────────────────────────
  getTasks: () => cloudReq("/tasks"),
  createTask: (data) => cloudReq("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id, data) => cloudReq(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTask: (id) => cloudReq(`/tasks/${id}`, { method: "DELETE" }),
  getCategories: () => cloudReq("/tasks/categories"),
  addComment: (taskId, text) =>
    cloudReq(`/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ text }) }),

  // ── Home Assistant (local) ───────────────────────────────────
  haStates: () => localReq("/ha/states"),
  haService: (domain, service, data) =>
    localReq(`/ha/services/${domain}/${service}`, { method: "POST", body: JSON.stringify(data) }),

  // ── Phone location (cloud) ───────────────────────────────────
  sendPhoneLocation: (latitude, longitude, speed, accuracy) =>
    cloudReq("/logs/phone", { method: "POST", body: JSON.stringify({ latitude, longitude, speed, accuracy }) }),

  // ── Chat (cloud) ─────────────────────────────────────────────
  getChatUsers: (q) => cloudReq(`/chat/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getChatMessages: (recipientId, limit = 50) =>
    cloudReq(`/chat/messages?limit=${limit}${recipientId ? `&recipientId=${recipientId}` : ""}`),
  sendChatMessage: (text, recipientId) =>
    cloudReq("/chat/messages", { method: "POST", body: JSON.stringify({ text, recipientId: recipientId || null }) }),
  getChatUnread: () => cloudReq("/chat/unread"),

  // ── Chat (local) ─────────────────────────────────────────────
  getChatUsersLocal: (q) => localReq(`/chat/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getChatMessagesLocal: (recipientId, limit = 50) =>
    localReq(`/chat/messages?limit=${limit}${recipientId ? `&recipientId=${recipientId}` : ""}`),
  sendChatMessageLocal: (text, recipientId) =>
    localReq("/chat/messages", { method: "POST", body: JSON.stringify({ text, recipientId: recipientId || null }) }),
  getChatUnreadLocal: () => localReq("/chat/unread"),

  // ── Profile (cloud) ──────────────────────────────────────────
  changePassword: (currentPassword, newPassword) =>
    cloudReq("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),

  // ── Zones (cloud) ────────────────────────────────────────────
  getZones: () => cloudReq("/zones"),
  createZone: (data) => cloudReq("/zones", { method: "POST", body: JSON.stringify(data) }),
  deleteZone: (id) => cloudReq(`/zones/${id}`, { method: "DELETE" }),

  // ── AI Agent (cloud) ─────────────────────────────────────────
  agentChat: (message, history) =>
    cloudReq("/agent/chat", { method: "POST", body: JSON.stringify({ message, history }) }),

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
