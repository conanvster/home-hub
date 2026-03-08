const router = require("express").Router();
const auth = require("../middleware/auth");
const Task = require("../models/Task");

// GET /api/tasks
router.get("/", auth, async (req, res) => {
  const tasks = await Task.find().sort({ column: 1, order: 1 }).lean();
  res.json(tasks);
});

// POST /api/tasks
router.post("/", auth, async (req, res) => {
  const { title, description, category, priority, column } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const maxOrder = await Task.findOne({ column: column || "idea" })
    .sort({ order: -1 })
    .lean();
  const task = await Task.create({
    title,
    description,
    category,
    priority,
    column,
    order: maxOrder ? maxOrder.order + 1 : 0,
  });
  res.status(201).json(task);
});

// PATCH /api/tasks/:id
router.patch("/:id", auth, async (req, res) => {
  const { title, description, category, priority, column, order } = req.body;
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: { title, description, category, priority, column, order } },
    { new: true, runValidators: true }
  );
  if (!task) return res.status(404).json({ error: "Not found" });
  res.json(task);
});

// DELETE /api/tasks/:id
router.delete("/:id", auth, async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
