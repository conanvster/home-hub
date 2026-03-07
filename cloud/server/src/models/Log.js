const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    imei: { type: String, required: true, index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    speed: { type: Number, default: 0 },
    direction: { type: Number, default: 0 },
    deviceTime: { type: Date, default: Date.now },
    raw: { type: String },
  },
  { timestamps: true }
);

// Index for sync queries (pull by date range)
logSchema.index({ createdAt: 1 });
logSchema.index({ imei: 1, createdAt: -1 });

module.exports = mongoose.model("Log", logSchema);
