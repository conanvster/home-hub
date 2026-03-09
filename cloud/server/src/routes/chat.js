const router = require("express").Router();
const auth = require("../middleware/auth");
const ChatMessage = require("../models/ChatMessage");

// GET /api/chat/messages?limit=50
router.get("/messages", auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const messages = await ChatMessage.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/messages
router.post("/messages", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text required" });

    const msg = await ChatMessage.create({
      userId: req.user.id,
      email:  req.user.email,
      text:   text.trim(),
    });

    // Real-time broadcast
    req.app.get("io")?.emit("chat:message", msg);

    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
