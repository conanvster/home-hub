const router = require("express").Router();
const Log = require("../models/Log");

// GET /api/logs?imei=&from=&to=&limit=
router.get("/", async (req, res) => {
  const { imei, from, to, limit = 1000 } = req.query;
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

// GET /api/logs/latest — остання позиція кожного трекера
router.get("/latest", async (req, res) => {
  const imeis = await Log.distinct("imei");
  const result = await Promise.all(
    imeis.map(async (imei) => {
      const log = await Log.findOne({ imei }).sort({ deviceTime: -1 });
      return { imei, log };
    })
  );
  res.json(result);
});

module.exports = router;
