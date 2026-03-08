const router = require("express").Router();
const Log = require("../models/Log");
const Tracker = require("../models/Tracker");
const Zone = require("../models/Zone");
const TelegramMessage = require("../models/TelegramMessage");

// Sync endpoint for local server — authenticated by shared secret
function syncAuth(req, res, next) {
  const secret = req.headers["x-sync-secret"];
  if (secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// GET /api/sync?since=ISO_DATE&limit=10000
router.get("/", syncAuth, async (req, res) => {
  const { since, limit = 10000 } = req.query;
  const filter = {};
  if (since) filter.createdAt = { $gt: new Date(since) };

  const logs = await Log.find(filter)
    .sort({ createdAt: 1 })
    .limit(Number(limit));

  res.json({ count: logs.length, logs });
});

// GET /api/sync/trackers
router.get("/trackers", syncAuth, async (req, res) => {
  const trackers = await Tracker.find().lean();
  res.json(trackers);
});

// GET /api/sync/zones
router.get("/zones", syncAuth, async (req, res) => {
  const zones = await Zone.find().lean();
  res.json(zones);
});

// GET /api/sync/telegram?since=ISO_DATE&limit=1000
router.get("/telegram", syncAuth, async (req, res) => {
  const { since, limit = 1000 } = req.query;
  const filter = {};
  if (since) filter.createdAt = { $gt: new Date(since) };

  const messages = await TelegramMessage.find(filter)
    .sort({ createdAt: 1 })
    .limit(Number(limit))
    .lean();

  res.json({ count: messages.length, messages });
});

module.exports = router;
