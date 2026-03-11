const router = require("express").Router();
const auth = require("../middleware/auth");
const { requireVerified } = require("../middleware/auth");
const Task = require("../models/Task");
const KanbanSettings = require("../models/KanbanSettings");

const DEFAULT_CATEGORIES = ["home-hub", "будинок", "авто", "сад", "інше"];

async function getSettings(userId) {
  const settingsId = `kanban_${userId}`;
  let s = await KanbanSettings.findById(settingsId);
  if (!s) s = await KanbanSettings.create({ _id: settingsId, userId, categories: DEFAULT_CATEGORIES });
  return s;
}

// ── Категорії ─────────────────────────────────────────────────

router.get("/categories", auth, requireVerified, async (req, res) => {
  const s = await getSettings(req.user.id);
  res.json(s.categories);
});

router.post("/categories", auth, requireVerified, async (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const s = await getSettings(req.user.id);
  if (s.categories.includes(name)) return res.status(400).json({ error: "already exists" });
  s.categories.push(name);
  await s.save();
  res.json(s.categories);
});

router.delete("/categories/:name", auth, requireVerified, async (req, res) => {
  const s = await getSettings(req.user.id);
  s.categories = s.categories.filter((c) => c !== req.params.name);
  await s.save();
  res.json(s.categories);
});

// ── Задачі ────────────────────────────────────────────────────

router.get("/", auth, requireVerified, async (req, res) => {
  const tasks = await Task.find({ userId: req.user.id }).sort({ column: 1, order: 1 }).lean();
  res.json(tasks);
});

router.post("/", auth, requireVerified, async (req, res) => {
  const { title, description, category, priority, column, type, parentTask, linkedTasks } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const last = await Task.findOne({ userId: req.user.id, column: column || "idea" }).sort({ order: -1 }).lean();
  const task = await Task.create({
    userId:      req.user.id,
    title, description, category, priority,
    column:      column      || "idea",
    type:        type        || "task",
    parentTask:  parentTask  || null,
    linkedTasks: linkedTasks || [],
    order: last ? last.order + 1 : 0,
  });
  res.status(201).json(task);
});

router.patch("/:id", auth, requireVerified, async (req, res) => {
  const { title, description, category, priority, column, order, type, parentTask, linkedTasks } = req.body;
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { title, description, category, priority, column, order, type, parentTask, linkedTasks } },
    { new: true, runValidators: true }
  );
  if (!task) return res.status(404).json({ error: "Not found" });
  res.json(task);
});

router.delete("/:id", auth, requireVerified, async (req, res) => {
  await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ ok: true });
});

// ── Коментарі ─────────────────────────────────────────────────

router.post("/:id/comments", auth, requireVerified, async (req, res) => {
  const text = req.body.text?.trim();
  if (!text) return res.status(400).json({ error: "text required" });
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $push: { comments: { text } } },
    { new: true }
  );
  if (!task) return res.status(404).json({ error: "Not found" });
  res.json(task);
});

router.delete("/:id/comments/:commentId", auth, requireVerified, async (req, res) => {
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $pull: { comments: { _id: req.params.commentId } } },
    { new: true }
  );
  if (!task) return res.status(404).json({ error: "Not found" });
  res.json(task);
});

module.exports = router;
