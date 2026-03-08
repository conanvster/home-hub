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

// GET /api/telegram/queue — перегляд черги для web
router.get("/queue", auth, async (req, res) => {
  const { status, direction, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (direction) filter.direction = direction;
  const messages = await TelegramMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit));
  res.json(messages);
});

module.exports = router;
