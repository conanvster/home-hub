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

  // База знань (лише локальний режим — через local-server до хабу на ha.local)
  kbList: () => request("/kb/list"),
  kbSearch: (q) => request(`/kb/search?q=${encodeURIComponent(q)}`),
  kbGet: (path) => request(`/kb/get?path=${encodeURIComponent(path)}`),
  kbAsk: (question) => request("/kb/ask", { method: "POST", body: JSON.stringify({ question }) }),

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

  // Tasks (Kanban) — local only
  getTasks: () => request("/tasks"),
  createTask: (data) => request("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
  // Home Assistant
  haStates: () => request("/ha/states"),
  haService: (domain, service, data) =>
    request(`/ha/services/${domain}/${service}`, { method: "POST", body: JSON.stringify(data) }),
  haGetDashboard: () => request("/ha/dashboard"),
  haUpdateDashboard: (containers) =>
    request("/ha/dashboard", { method: "PUT", body: JSON.stringify({ containers }) }),

  addComment: (taskId, text) =>
    request(`/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ text }) }),
  deleteComment: (taskId, commentId) =>
    request(`/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" }),
  getCategories: () => request("/tasks/categories"),
  addCategory: (name) => request("/tasks/categories", { method: "POST", body: JSON.stringify({ name }) }),
  deleteCategory: (name) => request(`/tasks/categories/${encodeURIComponent(name)}`, { method: "DELETE" }),

  changePassword: (currentPassword, newPassword) =>
    request("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),

  adminInvite: (email, role) =>
    request("/admin/invite", { method: "POST", body: JSON.stringify({ email, role }) }),

  // Email verification
  verifyEmail: (token) => request(`/auth/verify-email?token=${token}`),
  resendVerification: () => request("/auth/resend-verification", { method: "POST" }),

  // Chat
  getChatUsers: (q) => request(`/chat/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getChatMessages: (recipientId, limit = 50) =>
    request(`/chat/messages?limit=${limit}${recipientId ? `&recipientId=${recipientId}` : ""}`),
  sendChatMessage: (text, recipientId) =>
    request("/chat/messages", { method: "POST", body: JSON.stringify({ text, recipientId: recipientId || null }) }),
  getChatUnread: () => request("/chat/unread"),

  // App settings
  getSettings: () => request("/settings"),
  updateSettings: (data) => request("/settings", { method: "PUT", body: JSON.stringify(data) }),

  // AI Agent (local only)
  agentChat: (message, history) =>
    request("/agent/chat", { method: "POST", body: JSON.stringify({ message, history }) }),

  // Local sync trigger
  triggerSync: () => request("/sync/trigger", { method: "POST" }),

  // Local telegram log
  getLocalTelegram: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/telegram?${qs}`);
  },

  // Local users (synced from cloud)
  getLocalUsers: () => request("/users"),

  // Push local data to cloud (disaster recovery)
  startPushToCloud: () => request("/push/start", { method: "POST" }),
  getPushStatus: () => request("/push/status"),
};
