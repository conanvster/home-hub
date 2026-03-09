const router = require("express").Router();
const HADashboard = require("../models/HADashboard");

const HA_URL = process.env.HA_URL || "http://localhost:8123";
const HA_TOKEN = process.env.HA_TOKEN || "";

const haHeaders = {
  Authorization: `Bearer ${HA_TOKEN}`,
  "Content-Type": "application/json",
};

// GET /api/ha/states — усі стани entities
router.get("/states", async (req, res) => {
  try {
    const r = await fetch(`${HA_URL}/api/states`, { headers: haHeaders });
    if (!r.ok) return res.status(r.status).json({ error: "HA error" });
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ha/services/:domain/:service — виклик сервісу
router.post("/services/:domain/:service", async (req, res) => {
  try {
    const r = await fetch(
      `${HA_URL}/api/services/${req.params.domain}/${req.params.service}`,
      { method: "POST", headers: haHeaders, body: JSON.stringify(req.body) }
    );
    if (!r.ok) return res.status(r.status).json({ error: "HA error" });
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ha/camera/:entityId — проксі знімка камери
router.get("/camera/:entityId", async (req, res) => {
  try {
    const r = await fetch(
      `${HA_URL}/api/camera_proxy/${req.params.entityId}`,
      { headers: haHeaders }
    );
    if (!r.ok) return res.status(r.status).end();
    res.set("Content-Type", r.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "no-store");
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (err) {
    res.status(500).end();
  }
});

// GET /api/ha/dashboard — отримати layout дашборду
router.get("/dashboard", async (req, res) => {
  try {
    let doc = await HADashboard.findById("default");
    if (!doc) doc = { containers: [] };
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ha/dashboard — зберегти layout дашборду
router.put("/dashboard", async (req, res) => {
  try {
    const { containers } = req.body;
    const doc = await HADashboard.findByIdAndUpdate(
      "default",
      { containers },
      { upsert: true, new: true }
    );
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
