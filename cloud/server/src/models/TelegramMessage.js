const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    direction: { type: String, enum: ["in", "out"], required: true },
    telegramId: { type: String, required: true },
    text: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "received"],
      default: function () {
        return this.direction === "in" ? "received" : "pending";
      },
    },
    error: { type: String, default: null },
    metadata: { type: Object, default: {} },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ status: 1, direction: 1 });
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("TelegramMessage", messageSchema);
