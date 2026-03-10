const express = require("express");
const router = express.Router();
const Log = require("../models/Log");
const Tracker = require("../models/Tracker");
const Zone = require("../models/Zone");
const TelegramMessage = require("../models/TelegramMessage");
const User = require("../models/User");
const ZoneEvent = require("../models/ZoneEvent");
const ZoneState = require("../models/ZoneState");

function syncAuth(req, res, next) {
  const secret = req.headers["x-sync-secret"];
  if (secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// GET /api/sync?since=ISO&telegramSince=ISO&zoneEventSince=ISO&limit=10000
// Returns all data in one request:
//   logs + telegram + zoneEvents — incremental (since)
//   trackers, zones, users, zoneStates — full list
router.get("/", syncAuth, async (req, res) => {
  const { since, telegramSince, zoneEventSince, limit = 10000 } = req.query;

  const logsFilter = since ? { createdAt: { $gt: new Date(since) } } : {};
  const telegramFilter = telegramSince ? { createdAt: { $gt: new Date(telegramSince) } } : {};
  const zoneEventFilter = zoneEventSince ? { createdAt: { $gt: new Date(zoneEventSince) } } : {};

  const [logs, trackers, zones, telegram, users, zoneEvents, zoneStates] = await Promise.all([
    Log.find(logsFilter).sort({ createdAt: 1 }).limit(Number(limit)).lean(),
    Tracker.find().lean(),
    Zone.find().lean(),
    TelegramMessage.find(telegramFilter).sort({ createdAt: 1 }).limit(1000).lean(),
    User.find().select("email role telegramId password createdAt").lean(),
    ZoneEvent.find(zoneEventFilter).sort({ createdAt: 1 }).limit(5000).lean(),
    ZoneState.find().lean(),
  ]);

  res.json({
    logs: { count: logs.length, items: logs },
    trackers,
    zones,
    telegram: { count: telegram.length, items: telegram },
    users,
    zoneEvents: { count: zoneEvents.length, items: zoneEvents },
    zoneStates,
  });
});

// POST /api/sync/restore/meta — full replace of small collections (trackers, zones, users, telegram)
// Used for disaster recovery: local server pushes data to restore cloud
router.post("/restore/meta", syncAuth, express.json({ limit: "10mb" }), async (req, res) => {
  const { trackers = [], zones = [], users = [], telegram = [] } = req.body;

  await Promise.all([
    Tracker.deleteMany({}).then(() => trackers.length && Tracker.insertMany(trackers, { ordered: false })),
    Zone.deleteMany({}).then(() => zones.length && Zone.insertMany(zones, { ordered: false })),
    TelegramMessage.deleteMany({}).then(() => telegram.length && TelegramMessage.insertMany(telegram, { ordered: false })),
  ]);

  // Users: restore with password hashes (passwordHash → password field)
  await User.deleteMany({});
  if (users.length) {
    const userDocs = users.map(({ passwordHash, cloudId, _id, ...u }) => ({
      ...u,
      _id: cloudId || _id,
      password: passwordHash || u.password || "RESET_REQUIRED",
    }));
    await User.insertMany(userDocs, { ordered: false });
  }

  res.json({
    ok: true,
    restored: { trackers: trackers.length, zones: zones.length, users: users.length, telegram: telegram.length },
  });
});

// POST /api/sync/restore/logs — batch upsert of logs (call multiple times for large datasets)
// Body: { items: [...], clear: bool }  clear=true only on first batch
router.post("/restore/logs", syncAuth, express.json({ limit: "50mb" }), async (req, res) => {
  const { items = [], clear = false } = req.body;

  if (clear) await Log.deleteMany({});

  let inserted = 0;
  for (const log of items) {
    try {
      await Log.create({
        _id: log.cloudId || log._id,
        imei: log.imei,
        latitude: log.latitude,
        longitude: log.longitude,
        speed: log.speed,
        direction: log.direction,
        deviceTime: log.deviceTime,
        raw: log.raw,
        cloudId: log.cloudId || log._id,
      });
      inserted++;
    } catch {
      // duplicate — skip
    }
  }

  res.json({ ok: true, inserted, total: items.length });
});

module.exports = router;
