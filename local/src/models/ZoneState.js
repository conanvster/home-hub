const mongoose = require("mongoose");

const zoneStateSchema = new mongoose.Schema({
  imei:     { type: String, required: true },
  zoneId:   { type: mongoose.Schema.Types.ObjectId },
  userId:   { type: mongoose.Schema.Types.ObjectId },
  isInside: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
});

zoneStateSchema.index({ imei: 1, zoneId: 1 }, { unique: true });

module.exports = mongoose.model("ZoneState", zoneStateSchema);
