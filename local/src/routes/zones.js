const router = require("express").Router();
const Zone = require("../models/Zone");

// GET /api/zones
router.get("/", async (req, res) => {
  const zones = await Zone.find().lean();
  res.json(zones);
});

module.exports = router;
