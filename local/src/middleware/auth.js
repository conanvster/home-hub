const jwt = require("jsonwebtoken");

// Кеш успішно перевірених cloud-токенів (TTL 5 хв)
const cloudTokenCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function verifyViaCloud(token) {
  const now = Date.now();
  const cached = cloudTokenCache.get(token);
  if (cached && now - cached.ts < CACHE_TTL) return cached.user;

  const cloudUrl = process.env.CLOUD_URL;
  if (!cloudUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${cloudUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const user = await res.json();
    const parsed = { id: user._id, email: user.email, role: user.role };
    cloudTokenCache.set(token, { user: parsed, ts: now });
    // Чистимо старі записи кожні 50 токенів
    if (cloudTokenCache.size > 50) {
      for (const [k, v] of cloudTokenCache) {
        if (now - v.ts > CACHE_TTL) cloudTokenCache.delete(k);
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  // 1. Спочатку локальний JWT
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {}

  // 2. Якщо не вдалося — перевіряємо через хмарний сервер
  const user = await verifyViaCloud(token);
  if (user) {
    req.user = user;
    return next();
  }

  res.status(401).json({ error: "Invalid token" });
};
