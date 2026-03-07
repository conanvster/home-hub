const mongoose = require("mongoose");

// Історія подій входу/виходу із зон
const zoneEventSchema = new mongoose.Schema({
  imei:        { type: String, required: true },
  zoneId:      { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
  zoneName:    { type: String },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  trackerName: { type: String },
  event:       { type: String, enum: ["enter", "exit"], required: true },
  lat:         { type: Number },
  lng:         { type: Number },
}, { timestamps: true });

zoneEventSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ZoneEvent", zoneEventSchema);
