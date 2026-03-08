const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  lat:    { type: Number, required: true },
  lng:    { type: Number, required: true },
  radius: { type: Number, required: true },
  color:  { type: String, default: "#f59e0b" },
  userId: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

module.exports = mongoose.model("Zone", zoneSchema);
