const mongoose = require("mongoose");

// Read-only mirror of cloud users (no passwords, no tokens)
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    role: { type: String, default: "viewer" },
    telegramId: { type: String, default: null },
    cloudId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
