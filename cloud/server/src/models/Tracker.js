const mongoose = require("mongoose");

const trackerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    imei: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    color: { type: String, default: "#e74c3c" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tracker", trackerSchema);
