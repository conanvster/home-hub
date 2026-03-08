const router = require("express").Router();
const Tracker = require("../models/Tracker");

// GET /api/trackers
router.get("/", async (req, res) => {
  const trackers = await Tracker.find().lean();
  res.json(trackers);
});

module.exports = router;
