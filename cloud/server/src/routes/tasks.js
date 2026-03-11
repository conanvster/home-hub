const router = require("express").Router();
const auth = require("../middleware/auth");
const Task = require("../models/Task");
const KanbanSettings = require("../models/KanbanSettings");

const DEFAULT_CATEGORIES = ["home-hub", "будинок", "авто", "сад", "інше"];

async function getSettings() {
  let s = await KanbanSettings.findById("kanban");
  if (!s) s = await KanbanSettings.create({ _id: "kanban", categories: DEFAULT_CATEGORIES });
  return s;
}

// ── Категорії ─────────────────────────────────────────────────

router.get("/categories", auth, async (req, res) => {
  const s = await getSettings();
  res.json(s.categories);
});

router.post("/categories", auth, async (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const s = await getSettings();
  if (s.categories.includes(name)) return res.status(400).json({ error: "already exists" });
  s.categories.push(name);
  await s.save();
  res.json(s.categories);
});

router.delete("/categories/:name", auth, async (req, res) => {
  const s = await getSettings();
  s.categories = s.categories.filter((c) => c !== req.params.name);
  await s.save();
  res.json(s.categories);
});

// ── Задачі ────────────────────────────────────────────────────

router.get("/", auth, async (req, res) => {
  const tasks = await Task.find().sort({ column: 1, order: 1 }).lean();
  res.json(tasks);
});

router.post("/", auth, async (req, res) => {
  const { title, description, category, priority, column, type, parentTask, linkedTasks } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const last = await Task.findOne({ column: column || "idea" }).sort({ order: -1 }).lean();
  const task = await Task.create({
    title, description, category, priority,
    column:      column      || "idea",
    type:        type        || "task",
    parentTask:  parentTask  || null,
    linkedTasks: linkedTasks || [],
    order: last ? last.order + 1 : 0,
  });
  res.status(201).json(task);
});

router.patch("/:id", auth, async (req, res) => {
  const { title, description, category, priority, column, order, type, parentTask, linkedTasks } = req.body;
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: { title, description, category, priority, column, order, type, parentTask, linkedTasks } },
    { new: true, runValidators: true }
  );
  if (!task) return res.status(404).json({ error: "Not found" });
  res.json(task);
});

router.delete("/:id", auth, async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ── Коментарі ─────────────────────────────────────────────────

router.post("/:id/comments", auth, async (req, res) => {
  const text = req.body.text?.trim();
  if (!text) return res.status(400).json({ error: "text required" });
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $push: { comments: { text } } },
    { new: true }
  );
  if (!task) return res.status(404).json({ error: "Not found" });
  res.json(task);
});

router.delete("/:id/comments/:commentId", auth, async (req, res) => {
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $pull: { comments: { _id: req.params.commentId } } },
    { new: true }
  );
  if (!task) return res.status(404).json({ error: "Not found" });
  res.json(task);
});

module.exports = router;
