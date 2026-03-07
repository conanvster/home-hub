const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

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

// GET /api/auth/me
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("email role telegramId");
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

module.exports = router;
