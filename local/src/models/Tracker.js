const mongoose = require("mongoose");

const trackerSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  imei:   { type: String, required: true, unique: true },
  color:  { type: String, default: "#e74c3c" },
  active: { type: Boolean, default: true },
  userId: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

module.exports = mongoose.model("Tracker", trackerSchema);
