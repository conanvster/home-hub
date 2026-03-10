const router = require("express").Router();
const auth = require("../middleware/auth");
const Log = require("../models/Log");
const Tracker = require("../models/Tracker");
const { checkZones } = require("../services/geofence");

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

// POST /api/logs/phone — координати від мобільного телефону
router.post("/phone", auth, async (req, res) => {
  try {
    const { latitude, longitude, speed = 0, accuracy } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ error: "latitude and longitude required" });

    const imei = `phone-${req.user.id}`;

    // Авто-реєстрація трекера якщо не існує
    await Tracker.findOneAndUpdate(
      { imei },
      { $setOnInsert: { name: "📱 Телефон", imei, userId: req.user.id, color: "#8b5cf6" } },
      { upsert: true, new: true }
    );

    const log = await Log.create({
      imei,
      latitude,
      longitude,
      speed: speed ? Math.round(speed * 3.6) : 0, // m/s → km/h
      deviceTime: new Date(),
    });

    // Перевірка геозон (Telegram + Push нотифікації)
    checkZones(log).catch((e) => console.error("[Phone geofence]", e.message));

    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
