const router = require("express").Router();
const auth = require("../middleware/auth");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");

// GET /api/chat/users — список всіх юзерів для пошуку
router.get("/users", auth, async (req, res) => {
  try {
    const { q } = req.query;
    const filter = { _id: { $ne: req.user.id } };
    if (q) filter.email = { $regex: q, $options: "i" };
    const users = await User.find(filter).select("email _id").limit(20).lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/messages?recipientId=...&limit=50
// recipientId відсутній = загальний чат
router.get("/messages", auth, async (req, res) => {
  try {
    const { recipientId, limit = 50 } = req.query;
    const lim = Math.min(parseInt(limit), 200);
    let filter;

    if (recipientId) {
      // Діалог між двома юзерами
      filter = {
        $or: [
          { senderId: req.user.id, recipientId },
          { senderId: recipientId, recipientId: req.user.id },
        ],
      };
      // Позначити вхідні як прочитані
      await ChatMessage.updateMany(
        { senderId: recipientId, recipientId: req.user.id, read: false },
        { $set: { read: true } }
      );
    } else {
      filter = { recipientId: null };
    }

    const messages = await ChatMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/unread — кількість непрочитаних по кожному відправнику
router.get("/unread", auth, async (req, res) => {
  try {
    const counts = await ChatMessage.aggregate([
      { $match: { recipientId: req.user.id, read: false } },
      { $group: { _id: "$senderId", count: { $sum: 1 } } },
    ]);
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/messages
router.post("/messages", auth, async (req, res) => {
  try {
    const { text, recipientId } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text required" });

    const msg = await ChatMessage.create({
      senderId:    req.user.id,
      senderEmail: req.user.email,
      recipientId: recipientId || null,
      text:        text.trim(),
    });

    const io = req.app.get("io");
    if (recipientId) {
      // Особисте — тільки відправнику і отримувачу
      io?.to(`user:${recipientId}`).emit("chat:message", msg);
      io?.to(`user:${req.user.id}`).emit("chat:message", msg);
    } else {
      // Загальний чат — усім, хто увійшов (не анонімним сокетам, home-hub #1)
      io?.to("authed").emit("chat:message", msg);
    }

    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
