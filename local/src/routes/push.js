const router = require("express").Router();
const { pushToCloud, getStatus } = require("../services/push");

// POST /api/push/start — start push to cloud (async)
router.post("/start", async (req, res) => {
  try {
    // Start async, don't await
    pushToCloud().catch(() => {});
    res.json({ ok: true, message: "Push started" });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// GET /api/push/status — poll progress
router.get("/status", (req, res) => {
  res.json(getStatus());
});

module.exports = router;
