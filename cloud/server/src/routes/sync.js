const router = require("express").Router();
const Log = require("../models/Log");

// Sync endpoint for local server — authenticated by shared secret
function syncAuth(req, res, next) {
  const secret = req.headers["x-sync-secret"];
  if (secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// GET /api/sync?since=ISO_DATE&limit=1000
router.get("/", syncAuth, async (req, res) => {
  const { since, limit = 1000 } = req.query;
  const filter = {};
  if (since) filter.createdAt = { $gt: new Date(since) };

  const logs = await Log.find(filter)
    .sort({ createdAt: 1 })
    .limit(Number(limit));

  res.json({ count: logs.length, logs });
});

module.exports = router;
