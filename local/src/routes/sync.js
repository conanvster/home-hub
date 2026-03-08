const router = require("express").Router();
const { syncFromCloud } = require("../services/sync");

let syncInProgress = false;

// POST /api/sync/trigger
router.post("/trigger", async (req, res) => {
  if (syncInProgress) {
    return res.status(409).json({ error: "Sync already in progress" });
  }
  syncInProgress = true;
  const start = Date.now();
  try {
    const result = await syncFromCloud();
    res.json({ ok: true, ...result, duration: Date.now() - start });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    syncInProgress = false;
  }
});

module.exports = router;
