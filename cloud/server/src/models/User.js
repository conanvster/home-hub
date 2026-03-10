const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "member", "viewer"], default: "member" },
    status: { type: String, enum: ["active", "pending"], default: "active" },
    inviteToken: { type: String, default: null },
    inviteTokenExpires: { type: Date, default: null },
    telegramId: { type: String, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
    telegramLinkCode: { type: String, default: null },
    telegramLinkCodeExpires: { type: Date, default: null },
    telegramLinkChatId: { type: String, default: null },
    expoPushToken: { type: String, default: null },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
