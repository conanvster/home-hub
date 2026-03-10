const mongoose = require("mongoose");

const syncStateSchema = new mongoose.Schema({
  lastSync: { type: Date, default: null },
  lastTelegramSync: { type: Date, default: null },
  lastZoneEventSync: { type: Date, default: null },
  totalSynced: { type: Number, default: 0 },
  lastError: { type: String, default: null },
  lastErrorAt: { type: Date, default: null },
  syncCount: { type: Number, default: 0 },
});

// Singleton — завжди один документ
syncStateSchema.statics.get = async function () {
  let state = await this.findOne();
  if (!state) state = await this.create({});
  return state;
};

module.exports = mongoose.model("SyncState", syncStateSchema);
