const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const mongoose = require("mongoose");

// Проста колекція для зберігання налаштувань (singleton документ)
const settingsSchema = new mongoose.Schema({
  apkUrl: { type: String, default: "" },
}, { collection: "appsettings" });

const Settings = mongoose.models.AppSettings || mongoose.model("AppSettings", settingsSchema);

// GET /api/settings — публічний
router.get("/", async (req, res) => {
  try {
    let s = await Settings.findOne();
    if (!s) s = await Settings.create({});
    res.json({ apkUrl: s.apkUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — тільки адмін
router.put("/", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const { apkUrl } = req.body;
  try {
    let s = await Settings.findOne();
    if (!s) s = await Settings.create({ apkUrl });
    else { s.apkUrl = apkUrl || ""; await s.save(); }
    res.json({ apkUrl: s.apkUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
