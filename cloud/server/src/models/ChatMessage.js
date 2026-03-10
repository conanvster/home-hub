const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema({
  senderId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  senderEmail: { type: String, required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null = загальний чат
  text:        { type: String, required: true, maxlength: 2000 },
  read:        { type: Boolean, default: false },
}, { timestamps: true });

// Індекс для швидкого пошуку діалогу між двома юзерами
chatMessageSchema.index({ senderId: 1, recipientId: 1 });
chatMessageSchema.index({ recipientId: 1, senderId: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
