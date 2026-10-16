// База знань — домашній хаб на ha.local (~/hub): перелік за теками, пошук, читання, питання.
// Сервер ходить у хаб власним ключем (роль «родина»: приватне — резюме тощо — не видно);
// ключ лежить лише в local/.env (HUB_KEY), у браузер не потрапляє.
const router = require("express").Router();

const HUB_URL = process.env.HUB_URL || "http://192.168.1.34:8765";

async function hub(method, path, body, timeoutMs = 15000, key = process.env.HUB_KEY) {
  if (!key) {
    const err = new Error("База знань не підключена: на сервері немає HUB_KEY у local/.env");
    err.status = 503;
    throw err;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${HUB_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || data.detail || `хаб відповів HTTP ${res.status}`);
      err.status = res.status === 404 ? 404 : 502;
      throw err;
    }
    return data;
  } catch (e) {
    if (e.status) throw e;
    // Хаб недоступний — кажемо прямо, а не віддаємо порожній список
    const err = new Error(e.name === "AbortError"
      ? "База знань не відповіла вчасно"
      : `База знань недоступна (${HUB_URL}): ${e.cause?.code || e.message}`);
    err.status = 502;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const wrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};

// Розкладати записи з вхідних по теках (S1 хабу: «переносити — лише власник, з підтвердженням»)
// може лише адміністратор Home Hub — це власник. Для цього окремий ключ хабу з роллю filer:
// уміє тільки перенести спільний запис з inbox/ у теку, приватного не бачить.
const isAdmin = (req) => req.user?.role === "admin";
const filerKey = () => process.env.HUB_FILER_KEY;

// GET /api/kb/list — усі записи з теками; адміністратору ще й теки, куди можна розкласти
router.get("/list", wrap((req) =>
  isAdmin(req) && filerKey() ? hub("GET", "/api/list", null, 15000, filerKey()) : hub("GET", "/api/list")));

// POST /api/kb/file {path, folder} — розкласти запис із вхідних у теку (лише адміністратор)
router.post("/file", wrap((req) => {
  if (!isAdmin(req)) {
    const err = new Error("Розкладати записи може лише адміністратор");
    err.status = 403;
    throw err;
  }
  if (!filerKey()) {
    const err = new Error("На сервері немає HUB_FILER_KEY у local/.env — перенесення не налаштоване");
    err.status = 503;
    throw err;
  }
  const { path, folder } = req.body || {};
  return hub("POST", "/api/file", { path: String(path || ""), folder: String(folder || "") }, 30000, filerKey());
}));

// GET /api/kb/search?q=… — пошук за змістом і словами
router.get("/search", wrap((req) => {
  const q = String(req.query.q || "").trim();
  if (!q) return { query: "", results: [] };
  return hub("GET", `/api/search?q=${encodeURIComponent(q)}&limit=12`);
}));

// GET /api/kb/stats — дашборд: записи, запити до моделі, що чекає, пристрої (без текстів)
router.get("/stats", wrap(() => hub("GET", "/api/stats")));

// GET /api/kb/get?path=… — повний текст запису
router.get("/get", wrap((req) => hub("GET", `/api/get?path=${encodeURIComponent(String(req.query.path || ""))}`)));

// POST /api/kb/ask {question} — як голос із телефона: «Марс» на ПК, а без ПК — відповідь із бази
router.post("/ask", wrap((req) => {
  const text = String(req.body?.question || "").trim();
  if (!text) {
    const err = new Error("Порожнє питання");
    err.status = 400;
    throw err;
  }
  return hub("POST", "/api/assist", { text }, 100000);
}));

module.exports = router;
