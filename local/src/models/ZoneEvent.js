const mongoose = require("mongoose");

const zoneEventSchema = new mongoose.Schema({
  imei:        { type: String, required: true },
  zoneId:      { type: mongoose.Schema.Types.ObjectId },
  zoneName:    { type: String },
  userId:      { type: mongoose.Schema.Types.ObjectId },
  trackerName: { type: String },
  event:       { type: String, enum: ["enter", "exit"] },
  lat:         { type: Number },
  lng:         { type: Number },
  cloudId:     { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
}, { timestamps: true });

zoneEventSchema.index({ imei: 1, createdAt: -1 });

module.exports = mongoose.model("ZoneEvent", zoneEventSchema);
