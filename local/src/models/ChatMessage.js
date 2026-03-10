const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema({
  senderId:    { type: String, required: true }, // userId or "ai"
  senderEmail: { type: String, required: true },
  recipientId: { type: String, default: null },  // null = загальний чат
  text:        { type: String, required: true, maxlength: 4000 },
  read:        { type: Boolean, default: false },
}, { timestamps: true });

chatMessageSchema.index({ senderId: 1, recipientId: 1 });
chatMessageSchema.index({ recipientId: 1, read: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
