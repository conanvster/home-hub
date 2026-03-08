const router = require("express").Router();
const TelegramMessage = require("../models/TelegramMessage");

// GET /api/telegram?page=1&limit=50&direction=&status=
router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const filter = {};
  if (req.query.direction) filter.direction = req.query.direction;
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    TelegramMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    TelegramMessage.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

module.exports = router;
