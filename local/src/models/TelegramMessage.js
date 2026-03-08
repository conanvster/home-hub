const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    direction: { type: String, enum: ["in", "out"] },
    telegramId: { type: String },
    text: { type: String },
    status: { type: String },
    error: { type: String, default: null },
    metadata: { type: Object, default: {} },
    processedAt: { type: Date, default: null },
    cloudId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("TelegramMessage", messageSchema);
