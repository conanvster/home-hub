const router = require("express").Router();
const auth = require("../middleware/auth");
const Zone = require("../models/Zone");

// GET /api/zones
router.get("/", auth, async (req, res) => {
  const zones = await Zone.find({ userId: req.user.id });
  res.json(zones);
});

// POST /api/zones
router.post("/", auth, async (req, res) => {
  const { name, lat, lng, radius, color } = req.body;
  if (!name || lat == null || lng == null) {
    return res.status(400).json({ error: "name, lat, lng required" });
  }
  const zone = await Zone.create({ name, lat, lng, radius, color, userId: req.user.id });
  res.status(201).json(zone);
});

// PATCH /api/zones/:id
router.patch("/:id", auth, async (req, res) => {
  const { name, lat, lng, radius, color } = req.body;
  const zone = await Zone.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { name, lat, lng, radius, color } },
    { new: true }
  );
  if (!zone) return res.status(404).json({ error: "Not found" });
  res.json(zone);
});

// DELETE /api/zones/:id
router.delete("/:id", auth, async (req, res) => {
  await Zone.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ ok: true });
});

module.exports = router;
