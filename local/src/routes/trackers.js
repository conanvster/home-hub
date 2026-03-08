const router = require("express").Router();
const Log = require("../models/Log");

// GET /api/trackers — унікальні IMEI з останньою позицією
router.get("/", async (req, res) => {
  const imeis = await Log.distinct("imei");
  res.json(imeis.map((imei) => ({ imei, name: imei })));
});

module.exports = router;
