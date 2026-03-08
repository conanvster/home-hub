const BASE = "/api";

function getToken() {
  const auth = JSON.parse(localStorage.getItem("auth") || "{}");
  return auth?.state?.token;
}

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
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

export const api = {
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  register: (email, password) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),

  forgotPassword: (email) =>
    request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  resetPassword: (token, password) =>
    request("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),

  getTrackers: () => request("/trackers"),

  getLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/logs?${qs}`);
  },

  getLatest: () => request("/logs/latest"),

  createTracker: (data) =>
    request("/trackers", { method: "POST", body: JSON.stringify(data) }),

  updateTracker: (id, data) =>
    request(`/trackers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteTracker: (id) =>
    request(`/trackers/${id}`, { method: "DELETE" }),

  getMe: () => request("/auth/me"),

  generateTelegramLink: () =>
    request("/auth/telegram-link", { method: "POST" }),

  unlinkTelegram: () =>
    request("/auth/telegram-link", { method: "DELETE" }),

  getZones: () => request("/zones"),

  createZone: (data) =>
    request("/zones", { method: "POST", body: JSON.stringify(data) }),

  updateZone: (id, data) =>
    request(`/zones/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteZone: (id) =>
    request(`/zones/${id}`, { method: "DELETE" }),

  getSyncStatus: () => request("/status"),

  // Admin
  adminGetUsers: () => request("/admin/users"),
  adminUpdateUser: (id, data) =>
    request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  adminDeleteUser: (id) =>
    request(`/admin/users/${id}`, { method: "DELETE" }),
  adminGetTelegram: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/telegram?${qs}`);
  },
  adminRestore: (backup) =>
    request("/admin/restore", { method: "POST", body: JSON.stringify(backup) }),

  // Local sync trigger
  triggerSync: () => request("/sync/trigger", { method: "POST" }),

  // Local telegram log
  getLocalTelegram: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/telegram?${qs}`);
  },

  // Local users (synced from cloud)
  getLocalUsers: () => request("/users"),
};
