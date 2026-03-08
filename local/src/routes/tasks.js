const router = require("express").Router();
const Task = require("../models/Task");
const KanbanSettings = require("../models/KanbanSettings");

const DEFAULT_CATEGORIES = ["home-hub", "будинок", "авто", "сад", "інше"];

async function getSettings() {
  let s = await KanbanSettings.findById("kanban");
  if (!s) s = await KanbanSettings.create({ _id: "kanban", categories: DEFAULT_CATEGORIES });
  return s;
}

// ── Категорії ─────────────────────────────────────────────────
router.get("/categories", async (req, res) => {
  const s = await getSettings();
  res.json(s.categories);
});

router.post("/categories", async (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const s = await getSettings();
  if (s.categories.includes(name)) return res.status(400).json({ error: "already exists" });
  s.categories.push(name);
  await s.save();
  res.json(s.categories);
});

router.delete("/categories/:name", async (req, res) => {
  const s = await getSettings();
  s.categories = s.categories.filter((c) => c !== req.params.name);
  await s.save();
  res.json(s.categories);
});

// ── Задачі ────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const tasks = await Task.find().sort({ column: 1, order: 1 }).lean();
  res.json(tasks);
});

router.post("/", async (req, res) => {
  const { title, description, category, priority, column } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const last = await Task.findOne({ column: column || "idea" }).sort({ order: -1 }).lean();
  const task = await Task.create({
    title, description, category, priority, column,
    order: last ? last.order + 1 : 0,
  });
  res.status(201).json(task);
});

router.patch("/:id", async (req, res) => {
  const { title, description, category, priority, column, order } = req.body;
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: { title, description, category, priority, column, order } },
    { new: true, runValidators: true }
  );
  if (!task) return res.status(404).json({ error: "Not found" });
  res.json(task);
});

router.delete("/:id", async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
