const router = require("express").Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { sendPasswordReset, sendTelegramCode } = require("../services/email");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  res.json({ token, user: { id: user._id, email: user.email, role: user.role } });
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: "Email already registered" });

  const user = await User.create({ email, password, role: "viewer" });

  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  res.status(201).json({ token, user: { id: user._id, email: user.email, role: user.role } });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const user = await User.findOne({ email });
  // Always return success to avoid email enumeration
  if (!user) return res.json({ message: "If this email exists, a reset link has been sent" });

  const token = crypto.randomBytes(32).toString("hex");
  user.resetToken = token;
  user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  try {
    await sendPasswordReset(email, token);
  } catch (err) {
    console.error("[Email] Failed to send reset email:", err.message);
    return res.status(500).json({ error: "Failed to send email. Try again later." });
  }

  res.json({ message: "If this email exists, a reset link has been sent" });
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "Token and password required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const user = await User.findOne({
    resetToken: token,
    resetTokenExpires: { $gt: new Date() },
  });
  if (!user) return res.status(400).json({ error: "Invalid or expired reset token" });

  user.password = password;
  user.resetToken = null;
  user.resetTokenExpires = null;
  await user.save();

  res.json({ message: "Password updated successfully" });
});

// POST /api/auth/telegram-link — згенерувати код для прив'язки через сайт (Варіант C)
router.post("/telegram-link", auth, async (req, res) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const user = await User.findById(req.user.id);
  user.telegramLinkCode = code;
  user.telegramLinkCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
  user.telegramLinkChatId = null;
  await user.save();
  res.json({ code });
});

// DELETE /api/auth/telegram-link — відключити Telegram
router.delete("/telegram-link", auth, async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { telegramId: null });
  res.json({ message: "Telegram відключено" });
});

// GET /api/auth/me
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("email role telegramId");
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

// GET /api/auth/accept-invite/:token — перевірити токен запрошення
router.get("/accept-invite/:token", async (req, res) => {
  const user = await User.findOne({
    inviteToken: req.params.token,
    inviteTokenExpires: { $gt: new Date() },
    status: "pending",
  }).select("email role");
  if (!user) return res.status(400).json({ error: "Посилання недійсне або вже використане" });
  res.json({ email: user.email, role: user.role });
});

// POST /api/auth/accept-invite/:token — встановити пароль і активувати
router.post("/accept-invite/:token", async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: "Пароль мінімум 6 символів" });

  const user = await User.findOne({
    inviteToken: req.params.token,
    inviteTokenExpires: { $gt: new Date() },
    status: "pending",
  });
  if (!user) return res.status(400).json({ error: "Посилання недійсне або вже використане" });

  user.password = password;
  user.status = "active";
  user.inviteToken = null;
  user.inviteTokenExpires = null;
  await user.save();

  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
  res.json({ token, user: { id: user._id, email: user.email, role: user.role } });
});

// POST /api/auth/push-token — зберегти Expo push token
router.post("/push-token", auth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });
  await User.findByIdAndUpdate(req.user.id, { expoPushToken: token });
  res.json({ ok: true });
});

module.exports = router;
