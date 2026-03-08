const router = require("express").Router();
const Log = require("../models/Log");
const SyncState = require("../models/SyncState");

// GET /api/status — стан синхронізації
router.get("/", async (req, res) => {
  const state = await SyncState.get();
  const totalLogs = await Log.countDocuments();
  res.json({
    lastSync: state.lastSync,
    totalSynced: state.totalSynced,
    totalLogs,
    lastError: state.lastError,
    lastErrorAt: state.lastErrorAt,
    syncCount: state.syncCount,
  });
});

module.exports = router;
