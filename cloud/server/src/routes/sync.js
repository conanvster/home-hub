const router = require("express").Router();
const Log = require("../models/Log");
const Tracker = require("../models/Tracker");
const Zone = require("../models/Zone");
const TelegramMessage = require("../models/TelegramMessage");
const User = require("../models/User");

function syncAuth(req, res, next) {
  const secret = req.headers["x-sync-secret"];
  if (secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// GET /api/sync?since=ISO&telegramSince=ISO&limit=10000
// Returns all data in one request:
//   logs + telegram — incremental (since)
//   trackers, zones, users — full list
router.get("/", syncAuth, async (req, res) => {
  const { since, telegramSince, limit = 10000 } = req.query;

  const logsFilter = since ? { createdAt: { $gt: new Date(since) } } : {};
  const telegramFilter = telegramSince ? { createdAt: { $gt: new Date(telegramSince) } } : {};

  const [logs, trackers, zones, telegram, users] = await Promise.all([
    Log.find(logsFilter).sort({ createdAt: 1 }).limit(Number(limit)).lean(),
    Tracker.find().lean(),
    Zone.find().lean(),
    TelegramMessage.find(telegramFilter).sort({ createdAt: 1 }).limit(1000).lean(),
    User.find().select("email role telegramId createdAt").lean(),
  ]);

  res.json({
    logs: { count: logs.length, items: logs },
    trackers,
    zones,
    telegram: { count: telegram.length, items: telegram },
    users,
  });
});

module.exports = router;
