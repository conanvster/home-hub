const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Middleware that checks email verification (12h grace period)
module.exports.requireVerified = async function requireVerified(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("emailVerified createdAt");
    if (!user) return res.status(401).json({ error: "User not found" });

    if (user.emailVerified) return next();

    // Grace period: 12 hours from registration
    const hoursElapsed = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed < 12) return next();

    return res.status(403).json({ error: "Email not verified", code: "EMAIL_NOT_VERIFIED" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
