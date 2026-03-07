const mongoose = require("mongoose");

// Поточний стан трекера відносно зони (один документ на пару imei+zone)
const zoneStateSchema = new mongoose.Schema({
  imei:     { type: String, required: true },
  zoneId:   { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isInside: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
});

zoneStateSchema.index({ imei: 1, zoneId: 1 }, { unique: true });

module.exports = mongoose.model("ZoneState", zoneStateSchema);
