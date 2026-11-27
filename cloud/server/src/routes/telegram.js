const router = require("express").Router();
const TelegramMessage = require("../models/TelegramMessage");
const auth = require("../middleware/auth");

function syncAuth(req, res, next) {
  if (req.headers["x-sync-secret"] !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// POST /api/telegram/queue — локальний бекенд або інший сервіс пушить повідомлення
router.post("/queue", syncAuth, async (req, res) => {
  const { telegramId, text, metadata } = req.body;
  if (!telegramId || !text) {
    return res.status(400).json({ error: "telegramId and text required" });
  }
  const msg = await TelegramMessage.create({
    direction: "out",
    telegramId,
    text,
    metadata: metadata || {},
    status: "pending",
  });
  res.json({ id: msg._id, status: msg.status });
});

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

// GET /api/telegram/queue — перегляд черги (лише admin, #8: там чужі повідомлення й telegramId)
router.get("/queue", auth, requireAdmin, async (req, res) => {
  const { status, direction, limit = 50 } = req.query;
  const filter = {};
  if (typeof status === "string" && status) filter.status = status;
  if (typeof direction === "string" && direction) filter.direction = direction;
  const messages = await TelegramMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit));
  res.json(messages);
});

module.exports = router;
