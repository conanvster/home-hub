const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    imei: { type: String, index: true },
    latitude: Number,
    longitude: Number,
    speed: Number,
    direction: Number,
    deviceTime: { type: Date, index: true },
    raw: String,
    cloudId: { type: String, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Log", logSchema);
