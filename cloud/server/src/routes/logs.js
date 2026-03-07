const router = require("express").Router();
const auth = require("../middleware/auth");
const Log = require("../models/Log");
const Tracker = require("../models/Tracker");

// GET /api/logs?imei=&from=&to=&limit=
router.get("/", auth, async (req, res) => {
  const { imei, from, to, limit = 500 } = req.query;

  // Verify tracker belongs to user
  if (imei) {
    const tracker = await Tracker.findOne({ imei, userId: req.user.id });
    if (!tracker) return res.status(403).json({ error: "Forbidden" });
  }

  const filter = {};
  if (imei) filter.imei = imei;
  if (from || to) {
    filter.deviceTime = {};
    if (from) filter.deviceTime.$gte = new Date(from);
    if (to) filter.deviceTime.$lte = new Date(to);
  }

  const logs = await Log.find(filter)
    .sort({ deviceTime: -1 })
    .limit(Number(limit));

  res.json(logs);
});

// GET /api/logs/latest — остання точка по кожному трекеру юзера
router.get("/latest", auth, async (req, res) => {
  const trackers = await Tracker.find({ userId: req.user.id, active: true });
  const results = await Promise.all(
    trackers.map(async (t) => {
      const log = await Log.findOne({ imei: t.imei }).sort({ deviceTime: -1 });
      return { tracker: t, log };
    })
  );
  res.json(results);
});

module.exports = router;
