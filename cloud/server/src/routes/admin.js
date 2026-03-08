const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const TelegramMessage = require("../models/TelegramMessage");
const Log = require("../models/Log");
const Tracker = require("../models/Tracker");
const Zone = require("../models/Zone");
const ZoneState = require("../models/ZoneState");
const ZoneEvent = require("../models/ZoneEvent");

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

// GET /api/admin/users
router.get("/users", auth, requireAdmin, async (req, res) => {
  const users = await User.find()
    .select("-password -resetToken -resetTokenExpires -telegramLinkCode -telegramLinkCodeExpires -telegramLinkChatId")
    .lean();
  res.json(users);
});

// PATCH /api/admin/users/:id — змінити роль
router.patch("/users/:id", auth, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!["admin", "viewer"].includes(role)) return res.status(400).json({ error: "Invalid role" });
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", auth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Cannot delete yourself" });
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// GET /api/admin/telegram?page=1&limit=50&direction=&status=
router.get("/telegram", auth, requireAdmin, async (req, res) => {
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

// GET /api/admin/backup — стрімінг JSON бекапу
router.get("/backup", auth, requireAdmin, async (req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="home-hub-backup-${date}.json"`);

  const models = [
    ["logs", Log],
    ["trackers", Tracker],
    ["zones", Zone],
    ["users", User],
    ["zonestates", ZoneState],
    ["zoneevents", ZoneEvent],
    ["telegrammessages", TelegramMessage],
  ];

  res.write(`{"version":"1.0","date":"${new Date().toISOString()}","collections":{`);
  for (let i = 0; i < models.length; i++) {
    const [name, Model] = models[i];
    res.write(`"${name}":[`);
    const cursor = Model.find().lean().cursor();
    let first = true;
    for await (const doc of cursor) {
      if (!first) res.write(",");
      res.write(JSON.stringify(doc));
      first = false;
    }
    res.write("]");
    if (i < models.length - 1) res.write(",");
  }
  res.write("}}");
  res.end();
});

// POST /api/admin/restore — відновлення з бекапу
router.post(
  "/restore",
  auth,
  requireAdmin,
  express.json({ limit: "500mb" }),
  async (req, res) => {
    const { collections } = req.body;
    if (!collections) return res.status(400).json({ error: "Invalid backup format" });

    const modelMap = {
      logs: Log,
      trackers: Tracker,
      zones: Zone,
      users: User,
      zonestates: ZoneState,
      zoneevents: ZoneEvent,
      telegrammessages: TelegramMessage,
    };

    const results = {};
    for (const [name, Model] of Object.entries(modelMap)) {
      const docs = collections[name];
      if (!Array.isArray(docs)) continue;
      await Model.deleteMany({});
      if (docs.length > 0) {
        await Model.insertMany(docs, { ordered: false });
      }
      results[name] = docs.length;
    }
    res.json({ ok: true, restored: results });
  }
);

module.exports = router;
