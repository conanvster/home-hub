const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  email:    { type: String, required: true },
  text:     { type: String, required: true, maxlength: 2000 },
}, { timestamps: true });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
