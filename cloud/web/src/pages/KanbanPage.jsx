import { useEffect, useState, useRef } from "react";
import { api } from "../services/api";
import { VERSION } from "../config";

// ── Константи ─────────────────────────────────────────────────
const COLUMNS = [
  { id: "idea",         label: "💡 Ідея" },
  { id: "in-progress",  label: "🔨 В роботі" },
  { id: "done",         label: "✅ Готово" },
  { id: "archive",      label: "🗄️ Архів" },
];

const PRIORITIES = [
  { id: "critical", label: "🔴 Критично", cls: "bg-red-900/60 text-red-300 border border-red-700" },
  { id: "high",     label: "🟠 Високий",  cls: "bg-orange-900/60 text-orange-300 border border-orange-700" },
  { id: "medium",   label: "🟡 Середній", cls: "bg-yellow-900/60 text-yellow-300 border border-yellow-700" },
  { id: "low",      label: "🟢 Низький",  cls: "bg-green-900/60 text-green-300 border border-green-700" },
];

// Палітра кольорів для категорій (циклічно по індексу)
const CAT_PALETTE = [
  "bg-blue-900/50 text-blue-300",
  "bg-amber-900/50 text-amber-300",
  "bg-cyan-900/50 text-cyan-300",
  "bg-lime-900/50 text-lime-300",
  "bg-gray-700 text-gray-300",
  "bg-purple-900/50 text-purple-300",
  "bg-pink-900/50 text-pink-300",
  "bg-teal-900/50 text-teal-300",
  "bg-indigo-900/50 text-indigo-300",
  "bg-rose-900/50 text-rose-300",
];

function catCls(categories, name) {
  const idx = categories.indexOf(name);
  return CAT_PALETTE[idx >= 0 ? idx % CAT_PALETTE.length : CAT_PALETTE.length - 1];
}

function prioInfo(id) {
  return PRIORITIES.find((p) => p.id === id) || PRIORITIES[2];
}

// ── Модальне вікно управління категоріями ─────────────────────
function CategoriesModal({ categories, onAdd, onDelete, onClose }) {
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    const name = input.trim();
    if (!name) return;
    setAdding(true);
    setError("");
    try {
      await onAdd(name);
      setInput("");
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold">Категорії</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {/* Список */}
          <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
            {categories.map((cat, i) => (
              <div key={cat} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
                <span className={`text-xs px-2 py-0.5 rounded ${CAT_PALETTE[i % CAT_PALETTE.length]}`}>
                  {cat}
                </span>
                <button
                  onClick={() => onDelete(cat)}
                  className="text-gray-500 hover:text-red-400 text-sm transition ml-2"
                  title="Видалити"
                >
                  ✕
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-2">Немає категорій</p>
            )}
          </div>

          {/* Додати */}
          <div className="flex gap-2 pt-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Нова категорія..."
              className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !input.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 transition"
            >
              +
            </button>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Модальне вікно задачі ──────────────────────────────────────
function TaskModal({ task, categories, onSave, onDelete, onClose }) {
  const isNew = !task._id;
  const [form, setForm] = useState({
    title: task.title || "",
    description: task.description || "",
    category: task.category || categories[0] || "інше",
    priority: task.priority || "medium",
    column: task.column || "idea",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`Видалити "${task.title}"?`)) return;
    setDeleting(true);
    try { await onDelete(task._id); } finally { setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold">{isNew ? "Нова задача" : "Редагувати"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Назва *</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Що потрібно зробити?"
            />
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">Опис</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              placeholder="Деталі..."
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-gray-400 text-xs mb-1 block">Пріоритет</label>
              <select
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-xs mb-1 block">Категорія</label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">Статус</label>
            <select
              value={form.column}
              onChange={(e) => set("column", e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-700">
          {!isNew ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-400 hover:text-red-300 text-sm disabled:opacity-50"
            >
              {deleting ? "Видалення..." : "Видалити"}
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
              Скасувати
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 transition"
            >
              {saving ? "Збереження..." : "Зберегти"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Картка задачі ──────────────────────────────────────────────
function TaskCard({ task, categories, onEdit, onDragStart, onDragEnd }) {
  const prio = prioInfo(task.priority);
  const cls = catCls(categories, task.category);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(task)}
      className="bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-gray-500 transition select-none"
    >
      <div className="flex gap-1.5 flex-wrap mb-2">
        <span className={`text-xs px-1.5 py-0.5 rounded ${prio.cls}`}>{prio.label}</span>
        {task.category && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${cls}`}>{task.category}</span>
        )}
      </div>
      <p className="text-white text-sm font-medium leading-snug">{task.title}</p>
      {task.description && (
        <p className="text-gray-400 text-xs mt-1 line-clamp-2">{task.description}</p>
      )}
      <p className="text-gray-600 text-xs mt-2">
        {new Date(task.createdAt).toLocaleDateString("uk-UA")}
      </p>
    </div>
  );
}

// ── Колонка ────────────────────────────────────────────────────
function KanbanColumn({ col, tasks, categories, onAdd, onEdit, onDrop, onDragStart, onDragEnd, isDragOver, onDragOver, onDragLeave }) {
  return (
    <div className="flex flex-col min-w-[230px] flex-1 max-w-[310px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold">{col.label}</span>
          <span className="text-gray-500 text-xs bg-gray-700 rounded-full px-2">{tasks.length}</span>
        </div>
        <button
          onClick={() => onAdd(col.id)}
          className="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 transition text-lg leading-none"
          title="Додати задачу"
        >
          +
        </button>
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, col.id)}
        className={`flex flex-col gap-2 flex-1 min-h-[120px] rounded-xl p-2 transition-colors ${
          isDragOver
            ? "bg-blue-900/20 border-2 border-blue-500/50 border-dashed"
            : "bg-gray-900/30 border-2 border-transparent"
        }`}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
            categories={categories}
            onEdit={onEdit}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
            Порожньо
          </div>
        )}
      </div>
    </div>
  );
}

// ── Головна сторінка ───────────────────────────────────────────
export default function KanbanPage() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);       // null | { task }
  const [showCats, setShowCats] = useState(false);
  const [dragOverCol, setDragOverCol] = useState(null);
  const dragTask = useRef(null);

  async function load() {
    const [t, c] = await Promise.all([api.getTasks(), api.getCategories()]);
    setTasks(t);
    setCategories(c);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Drag & Drop ────────────────────────────────────────────
  function handleDragStart(e, task) {
    dragTask.current = task;
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragEnd() {
    dragTask.current = null;
    setDragOverCol(null);
  }
  function handleDragOver(e, colId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
  }
  function handleDragLeave() { setDragOverCol(null); }

  async function handleDrop(e, colId) {
    e.preventDefault();
    setDragOverCol(null);
    const task = dragTask.current;
    if (!task || task.column === colId) return;
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, column: colId } : t)));
    try {
      await api.updateTask(task._id, { column: colId });
    } catch {
      load();
    }
  }

  // ── Задачі ─────────────────────────────────────────────────
  function openNew(colId) { setModal({ task: { column: colId } }); }
  function openEdit(task) { setModal({ task }); }

  async function handleSave(form) {
    const task = modal.task;
    if (task._id) {
      const updated = await api.updateTask(task._id, form);
      setTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    } else {
      const created = await api.createTask(form);
      setTasks((prev) => [...prev, created]);
    }
    setModal(null);
  }

  async function handleDelete(id) {
    await api.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t._id !== id));
    setModal(null);
  }

  // ── Категорії ──────────────────────────────────────────────
  async function handleAddCategory(name) {
    const updated = await api.addCategory(name);
    setCategories(updated);
  }

  async function handleDeleteCategory(name) {
    const updated = await api.deleteCategory(name);
    setCategories(updated);
  }

  const tasksByCol = (colId) =>
    tasks.filter((t) => t.column === colId).sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      {/* Хедер */}
      <header className="flex items-center bg-gray-800 border-b border-gray-700 px-4 h-12 flex-shrink-0">
        <span className="font-bold text-white mr-6 text-sm whitespace-nowrap">🏠 Home Hub</span>
        <nav className="flex flex-1 h-full">
          <span className="px-4 h-full text-sm border-b-2 border-blue-500 text-white flex items-center">
            Канбан
          </span>
          <a
            href="/map"
            className="px-4 h-full text-sm border-b-2 border-transparent text-gray-400 hover:text-white flex items-center transition"
          >
            Трекінг
          </a>
        </nav>
        <button
          onClick={() => setShowCats(true)}
          className="text-gray-400 hover:text-white text-xs px-3 transition whitespace-nowrap"
          title="Керування категоріями"
        >
          ⚙ Категорії
        </button>
        <span className="text-gray-600 text-xs font-mono mx-3 whitespace-nowrap hidden sm:inline">{VERSION}</span>
      </header>

      {/* Дошка */}
      <div className="flex-1 overflow-x-auto p-6">
        {loading ? (
          <div className="text-gray-400 text-sm">Завантаження...</div>
        ) : (
          <div className="flex gap-5 min-w-max h-full">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                tasks={tasksByCol(col.id)}
                categories={categories}
                onAdd={openNew}
                onEdit={openEdit}
                onDrop={handleDrop}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                isDragOver={dragOverCol === col.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Модальне вікно задачі */}
      {modal && (
        <TaskModal
          task={modal.task}
          categories={categories}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}

      {/* Модальне вікно категорій */}
      {showCats && (
        <CategoriesModal
          categories={categories}
          onAdd={handleAddCategory}
          onDelete={handleDeleteCategory}
          onClose={() => setShowCats(false)}
        />
      )}
    </div>
  );
}
