import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { VERSION } from "../config";

// ── Константи ─────────────────────────────────────────────────
const COLUMNS = [
  { id: "idea",        label: "💡 Ідея" },
  { id: "in-progress", label: "🔨 В роботі" },
  { id: "done",        label: "✅ Готово" },
  { id: "archive",    label: "🗄️ Архів" },
];

const PRIORITIES = [
  { id: "critical", label: "🔴 Критично",  cls: "bg-red-900/60 text-red-300 border-red-700" },
  { id: "high",     label: "🟠 Високий",   cls: "bg-orange-900/60 text-orange-300 border-orange-700" },
  { id: "medium",   label: "🟡 Середній",  cls: "bg-yellow-900/60 text-yellow-300 border-yellow-700" },
  { id: "low",      label: "🟢 Низький",   cls: "bg-green-900/60 text-green-300 border-green-700" },
];

const CATEGORIES = [
  { id: "home-hub", label: "home-hub", cls: "bg-blue-900/50 text-blue-300" },
  { id: "будинок",  label: "будинок",  cls: "bg-amber-900/50 text-amber-300" },
  { id: "авто",     label: "авто",     cls: "bg-cyan-900/50 text-cyan-300" },
  { id: "сад",      label: "сад",      cls: "bg-lime-900/50 text-lime-300" },
  { id: "інше",     label: "інше",     cls: "bg-gray-700/80 text-gray-300" },
];

function priorityInfo(id) {
  return PRIORITIES.find((p) => p.id === id) || PRIORITIES[2];
}
function categoryInfo(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[4];
}

// ── Модальне вікно додавання/редагування ─────────────────────
function TaskModal({ task, onSave, onDelete, onClose }) {
  const isNew = !task._id;
  const [form, setForm] = useState({
    title: task.title || "",
    description: task.description || "",
    category: task.category || "інше",
    priority: task.priority || "medium",
    column: task.column || "idea",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

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
          {/* Назва */}
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

          {/* Опис */}
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

          {/* Пріоритет + Категорія */}
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
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Колонка */}
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
function TaskCard({ task, onEdit, onDragStart, onDragEnd }) {
  const prio = priorityInfo(task.priority);
  const cat = categoryInfo(task.category);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(task)}
      className="bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-gray-500 transition select-none active:opacity-70"
    >
      {/* Priority + category */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        <span className={`text-xs px-1.5 py-0.5 rounded border ${prio.cls}`}>
          {prio.label}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${cat.cls}`}>
          {cat.label}
        </span>
      </div>

      {/* Title */}
      <p className="text-white text-sm font-medium leading-snug">{task.title}</p>

      {/* Description */}
      {task.description && (
        <p className="text-gray-400 text-xs mt-1 line-clamp-2">{task.description}</p>
      )}

      {/* Date */}
      <p className="text-gray-600 text-xs mt-2">
        {new Date(task.createdAt).toLocaleDateString("uk-UA")}
      </p>
    </div>
  );
}

// ── Колонка ────────────────────────────────────────────────────
function KanbanColumn({ col, tasks, onAdd, onEdit, onDrop, onDragStart, onDragEnd, isDragOver, onDragOver, onDragLeave }) {
  return (
    <div className="flex flex-col min-w-[220px] flex-1 max-w-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold">{col.label}</span>
          <span className="text-gray-500 text-xs bg-gray-700 rounded-full px-2">{tasks.length}</span>
        </div>
        <button
          onClick={() => onAdd(col.id)}
          className="text-gray-400 hover:text-white text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 transition"
          title="Додати задачу"
        >
          +
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, col.id)}
        className={`flex flex-col gap-2 flex-1 min-h-[120px] rounded-xl p-2 transition ${
          isDragOver ? "bg-blue-900/20 border-2 border-blue-500/50 border-dashed" : "bg-gray-900/30 border-2 border-transparent"
        }`}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
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
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { task }
  const [dragOverCol, setDragOverCol] = useState(null);
  const dragTask = useRef(null);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  async function load() {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } finally {
      setLoading(false);
    }
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

  function handleDragLeave() {
    setDragOverCol(null);
  }

  async function handleDrop(e, colId) {
    e.preventDefault();
    setDragOverCol(null);
    const task = dragTask.current;
    if (!task || task.column === colId) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t._id === task._id ? { ...t, column: colId } : t))
    );

    try {
      await api.updateTask(task._id, { column: colId });
    } catch {
      load(); // rollback on error
    }
  }

  // ── Modal actions ──────────────────────────────────────────
  function openNew(colId) {
    setModal({ task: { column: colId } });
  }

  function openEdit(task) {
    setModal({ task });
  }

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

  const tasksByCol = (colId) =>
    tasks
      .filter((t) => t.column === colId)
      .sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      {/* Хедер */}
      <header className="flex items-center bg-gray-800 border-b border-gray-700 px-4 h-12 flex-shrink-0">
        <span className="font-bold text-white mr-6 text-sm whitespace-nowrap">🏠 Home Hub</span>
        <nav className="flex flex-1 h-full">
          {[
            { label: "Трекінг", href: "/" },
            { label: "Налаштування", href: "/?tab=settings" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="px-4 h-full text-sm border-b-2 border-transparent text-gray-400 hover:text-white flex items-center transition"
            >
              {item.label}
            </a>
          ))}
          <span className="px-4 h-full text-sm border-b-2 border-blue-500 text-white flex items-center">
            Канбан
          </span>
          {user?.role === "admin" && (
            <a
              href="/admin"
              className="px-4 h-full text-sm border-b-2 border-transparent text-gray-400 hover:text-white flex items-center transition"
            >
              Адмін
            </a>
          )}
        </nav>
        <span className="text-gray-600 text-xs font-mono mx-3 whitespace-nowrap hidden sm:inline">{VERSION}</span>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-white text-sm px-3 transition whitespace-nowrap"
        >
          Вийти
        </button>
      </header>

      {/* Вміст */}
      <div className="flex-1 overflow-x-auto p-6">
        {loading ? (
          <div className="text-gray-400 text-sm">Завантаження...</div>
        ) : (
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                tasks={tasksByCol(col.id)}
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

      {/* Модальне вікно */}
      {modal && (
        <TaskModal
          task={modal.task}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
