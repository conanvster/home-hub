const router = require("express").Router();
const auth = require("../middleware/auth");
const Tracker = require("../models/Tracker");

// GET /api/trackers — список трекерів юзера
router.get("/", auth, async (req, res) => {
  const trackers = await Tracker.find({ userId: req.user.id });
  res.json(trackers);
});

// POST /api/trackers — додати трекер
router.post("/", auth, async (req, res) => {
  const { name, imei, color } = req.body;
  if (!name || !imei) return res.status(400).json({ error: "name and imei required" });
  const tracker = await Tracker.create({ name, imei, color, userId: req.user.id });
  res.status(201).json(tracker);
});

// PATCH /api/trackers/:id
router.patch("/:id", auth, async (req, res) => {
  const { name, color, active } = req.body;
  const tracker = await Tracker.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { name, color, active } },
    { new: true }
  );
  if (!tracker) return res.status(404).json({ error: "Not found" });
  res.json(tracker);
});

// DELETE /api/trackers/:id
router.delete("/:id", auth, async (req, res) => {
  await Tracker.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ ok: true });
});

module.exports = router;
