import { useEffect, useState, useRef } from "react";
import { api } from "../services/api";
import AppHeader from "../components/AppHeader";

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

const TASK_TYPES = [
  { id: "idea",    label: "💡 Ідея",      cls: "bg-amber-900/60 text-amber-300 border border-amber-600" },
  { id: "task",    label: "✦ Задача",     cls: "bg-blue-900/60 text-blue-300 border border-blue-700" },
  { id: "subtask", label: "↳ Підзадача",  cls: "bg-gray-700 text-gray-300 border border-gray-600" },
];

function typeInfo(id) {
  return TASK_TYPES.find((t) => t.id === id) || TASK_TYPES[1];
}

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
function TaskModal({ task, categories, allTasks, onSave, onDelete, onClose, onOpenTask }) {
  const isNew = !task._id;

  const [form, setForm] = useState({
    title: task.title || "",
    description: task.description || "",
    type: task.type || "task",
    category: task.category || categories[0] || "інше",
    priority: task.priority || "medium",
    column: task.column || "idea",
    linkedTasks: (task.linkedTasks || []).map((id) => String(id)),
  });
  const [comments, setComments] = useState(task.comments || []);
  const [commentInput, setCommentInput] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`Видалити "${task.title || form.title}"?`)) return;
    setDeleting(true);
    try { await onDelete(task._id); } finally { setDeleting(false); }
  }

  // ── Лінки ────────────────────────────────────────────────────
  const linkedTaskObjects = form.linkedTasks
    .map((id) => allTasks.find((t) => String(t._id) === id))
    .filter(Boolean);

  const availableToLink = allTasks.filter(
    (t) => t._id !== task._id && !form.linkedTasks.includes(String(t._id))
  );

  function addLink(id) {
    if (!id) return;
    set("linkedTasks", [...form.linkedTasks, id]);
  }

  function removeLink(id) {
    set("linkedTasks", form.linkedTasks.filter((x) => x !== id));
  }

  // ── Коментарі ─────────────────────────────────────────────────
  async function handleAddComment() {
    const text = commentInput.trim();
    if (!text || !task._id) return;
    setAddingComment(true);
    try {
      const updated = await api.addComment(task._id, text);
      setComments(updated.comments);
      setCommentInput("");
    } finally {
      setAddingComment(false);
    }
  }

  async function handleDeleteComment(commentId) {
    const updated = await api.deleteComment(task._id, commentId);
    setComments(updated.comments);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-white font-semibold">
            {isNew
              ? (form.type === "idea" ? "💡 Нова ідея" : form.type === "subtask" ? "↳ Нова підзадача" : "✦ Нова задача")
              : typeInfo(task.type).label + " — редагувати"
            }
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Контент — скролиться */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">

          {/* Назва */}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Назва *</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Що потрібно зробити?"
            />
          </div>

          {/* Тип */}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Тип</label>
            <div className="flex gap-2">
              {TASK_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set("type", t.id)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs border transition ${
                    form.type === t.id ? t.cls + " opacity-100" : "bg-gray-700 text-gray-400 border-gray-600 hover:border-gray-500"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Опис */}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Опис{form.type === "idea" ? " (контекст ідеї)" : ""}</label>
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
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Статус */}
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

          {/* ── Пов'язані задачі ─────────────────────────────── */}
          <div className="border-t border-gray-700 pt-4">
            <label className="text-gray-400 text-xs mb-2 block">Пов'язані задачі</label>

            {/* Список лінків */}
            {linkedTaskObjects.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-2">
                {linkedTaskObjects.map((t) => {
                  const col = COLUMNS.find((c) => c.id === t.column);
                  return (
                    <div key={t._id} className="flex items-center gap-2 bg-gray-700/50 rounded-lg px-3 py-1.5">
                      <button
                        onClick={() => onOpenTask(t)}
                        className="flex-1 flex items-center gap-2 text-left hover:text-blue-300 transition"
                      >
                        <span className="text-white text-sm truncate">{t.title}</span>
                        <span className="text-gray-400 text-xs whitespace-nowrap">{col?.label}</span>
                      </button>
                      <button
                        onClick={() => removeLink(String(t._id))}
                        className="text-gray-500 hover:text-red-400 text-sm flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Додати лінк */}
            {availableToLink.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => { addLink(e.target.value); e.target.value = ""; }}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="" disabled>+ Додати пов'язану задачу...</option>
                {availableToLink.map((t) => {
                  const col = COLUMNS.find((c) => c.id === t.column);
                  return (
                    <option key={t._id} value={String(t._id)}>
                      {t.title} ({col?.label || t.column})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* ── Коментарі ────────────────────────────────────── */}
          {!isNew && (
            <div className="border-t border-gray-700 pt-4">
              <label className="text-gray-400 text-xs mb-2 block">
                Коментарі {comments.length > 0 && `(${comments.length})`}
              </label>

              {comments.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {comments.map((c) => (
                    <div key={c._id} className="bg-gray-700/50 rounded-lg px-3 py-2 flex gap-2">
                      <div className="flex-1">
                        <p className="text-white text-sm">{c.text}</p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {new Date(c.createdAt).toLocaleString("uk-UA")}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(c._id)}
                        className="text-gray-600 hover:text-red-400 text-sm flex-shrink-0 self-start"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                  placeholder="Додати коментар..."
                  className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddComment}
                  disabled={addingComment || !commentInput.trim()}
                  className="px-3 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg disabled:opacity-50 transition"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-700 flex-shrink-0">
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
function TaskCard({ task, categories, allTasks, onEdit, onDragStart, onDragEnd }) {
  const prio = prioInfo(task.priority);
  const cat  = catCls(categories, task.category);
  const type = typeInfo(task.type);
  const isIdea    = task.type === "idea";
  const isSubtask = task.type === "subtask";

  // Для ідеї — знаходимо пов'язані задачі-кроки (не ідеї)
  const linkedIds = (task.linkedTasks || []).map(String);
  const linkedSteps = isIdea
    ? linkedIds.map((id) => allTasks.find((t) => String(t._id) === id)).filter(Boolean)
    : [];

  // Для задачі/підзадачі — знаходимо батьківську ідею серед лінків
  const parentIdea = !isIdea
    ? linkedIds
        .map((id) => allTasks.find((t) => String(t._id) === id && t.type === "idea"))
        .find(Boolean)
    : null;

  const STEP_ICONS = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(task)}
      className={`rounded-lg cursor-pointer transition select-none border ${
        isIdea
          ? "bg-amber-950/30 border-amber-700/70 hover:border-amber-500"
          : isSubtask
          ? "bg-gray-800/60 border-gray-700/50 hover:border-gray-500 ml-3 border-l-[3px] border-l-gray-500"
          : "bg-gray-800 border-gray-700 hover:border-gray-500"
      }`}
    >
      {/* Верхня частина картки */}
      <div className="p-3">
        <div className="flex gap-1.5 flex-wrap mb-2">
          {task.type && task.type !== "task" && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${type.cls}`}>{type.label}</span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded ${prio.cls}`}>{prio.label}</span>
          {task.category && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${cat}`}>{task.category}</span>
          )}
        </div>
        <p className="text-white text-sm font-medium leading-snug">{task.title}</p>
        {task.description && (
          <p className="text-gray-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">{task.description}</p>
        )}

        {/* Батьківська ідея (для task/subtask) */}
        {parentIdea && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-amber-600 text-xs">↑</span>
            <span className="text-amber-500/80 text-xs truncate">{parentIdea.title}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <p className="text-gray-600 text-xs">
            {new Date(task.createdAt).toLocaleDateString("uk-UA")}
          </p>
          {!isIdea && linkedIds.length > 0 && !parentIdea && (
            <span className="text-gray-500 text-xs">🔗 {linkedIds.length}</span>
          )}
        </div>
      </div>

      {/* Блок кроків (тільки для ідей з пов'язаними задачами) */}
      {isIdea && linkedSteps.length > 0 && (
        <div className="border-t border-amber-800/40 px-3 py-2">
          <p className="text-amber-600/70 text-[10px] uppercase tracking-wide mb-1.5 font-semibold">
            Кроки реалізації ({linkedSteps.length})
          </p>
          <div className="flex flex-col gap-1">
            {linkedSteps.slice(0, 4).map((step, i) => {
              const stepCol = COLUMNS.find((c) => c.id === step.column);
              const isDone  = step.column === "done" || step.column === "archive";
              return (
                <div key={step._id} className="flex items-start gap-1.5">
                  <span className={`text-[10px] flex-shrink-0 mt-0.5 ${isDone ? "text-green-500" : "text-amber-700"}`}>
                    {isDone ? "✓" : STEP_ICONS[i] || "·"}
                  </span>
                  <span className={`text-xs truncate ${isDone ? "text-gray-500 line-through" : "text-amber-200/80"}`}>
                    {step.title}
                  </span>
                  {step.column !== "idea" && (
                    <span className="text-gray-600 text-[10px] flex-shrink-0 ml-auto">{stepCol?.label}</span>
                  )}
                </div>
              );
            })}
            {linkedSteps.length > 4 && (
              <p className="text-gray-600 text-[10px] mt-0.5">+{linkedSteps.length - 4} ще...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Компактна картка задачі у swimlane ────────────────────────
function SwimlaneTaskCard({ task, categories, collapsed, onCollapse, onEdit, onDragStart, onDragEnd, isReady }) {
  const prio = prioInfo(task.priority);
  const type = typeInfo(task.type);
  const isSubtask = task.type === "subtask";
  const isBlocked    = !isReady && task.column === "idea";
  const canStart     = isReady  && task.column === "idea";
  const hasBody      = !!(task.description);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(task)}
      className={`mb-1.5 rounded-lg border cursor-pointer transition select-none ${
        isSubtask
          ? "ml-4 border-l-[3px] border-l-gray-500 bg-gray-800/50 border-gray-700/40 hover:border-gray-600"
          : "bg-gray-800/90 border-gray-700 hover:border-gray-500"
      } ${isBlocked ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-1.5 px-2.5 py-2">
        {/* Collapse toggle */}
        {hasBody && (
          <button
            onClick={onCollapse}
            className="text-gray-600 hover:text-gray-400 text-[10px] flex-shrink-0 mt-0.5 leading-none w-3"
          >
            {collapsed ? "▶" : "▼"}
          </button>
        )}
        {!hasBody && <span className="w-3 flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex gap-1 flex-wrap mb-1">
            {isSubtask && <span className={`text-[10px] px-1 py-0.5 rounded ${type.cls}`}>{type.label}</span>}
            <span className={`text-[10px] px-1 py-0.5 rounded ${prio.cls}`}>{prio.label}</span>
            {canStart  && <span className="text-[10px] text-green-500 font-semibold">▶ Старт</span>}
            {isBlocked && <span className="text-[10px] text-gray-600">⏳ Чекає</span>}
          </div>
          <p className="text-white text-xs font-medium leading-snug">{task.title}</p>
          {!collapsed && hasBody && (
            <p className="text-gray-500 text-[11px] mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Swimlane рядок для ідеї ─────────────────────────────────────
function IdeaSwimlane({
  idea, linkedTasks, categories, collapsed, collapsedTasks,
  onToggle, onToggleTask, onEdit, onAdd,
  onDrop, onDragStart, onDragEnd, dragOverCol, onDragOver, onDragLeave,
}) {
  const prio     = prioInfo(idea.priority);
  const isActive = idea.column !== "idea"; // ідея вже стартувала
  const total    = linkedTasks.length;
  const done     = linkedTasks.filter((t) => ["done", "archive"].includes(t.column)).length;

  const [mobileTab, setMobileTab] = useState("idea");

  return (
    <div className={`mb-3 rounded-xl overflow-hidden border ${
      isActive ? "border-amber-600/60" : "border-amber-800/35"
    }`}>

      {/* ── Заголовок ──────────────────────────────────────── */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition ${
          isActive ? "bg-amber-900/35 hover:bg-amber-900/50" : "bg-amber-950/25 hover:bg-amber-950/45"
        }`}
        onClick={onToggle}
      >
        <span className="text-amber-400 text-base flex-shrink-0">💡</span>

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{idea.title}</p>
          {idea.category && (
            <p className="text-amber-800/70 text-xs truncate">{idea.category}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded ${prio.cls}`}>{prio.label}</span>

          {total > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${Math.round((done / total) * 100)}%` }}
                />
              </div>
              <span className="text-gray-500 text-xs">{done}/{total}</span>
            </div>
          )}

          <span className={`text-xs px-2 py-0.5 rounded-full border hidden sm:inline ${
            isActive
              ? "border-amber-600 text-amber-400 bg-amber-900/30"
              : "border-gray-700 text-gray-500"
          }`}>
            {isActive ? "🔨 Активна" : "📋 Планування"}
          </span>

          <span className="text-gray-600 text-xs">{collapsed ? "▶" : "▼"}</span>
        </div>
      </div>

      {/* ── Тіло: десктоп — 4 міні-колонки ────────────────── */}
      {!collapsed && (
        <>
          <div className="hidden md:flex border-t border-amber-800/20 bg-gray-950/30">
            {COLUMNS.map((col, i) => {
              const isIdeaCol = col.id === "idea";
              const colTasks  = linkedTasks
                .filter((t) => t.column === col.id)
                .sort((a, b) => a.order - b.order);

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => onDragOver(e, col.id)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, col.id)}
                  className={`flex-1 min-w-0 p-2 transition-colors ${
                    i < 3 ? "border-r border-gray-800/40" : ""
                  } ${dragOverCol === col.id ? "bg-blue-900/20" : ""}`}
                >
                  {/* Опис ідеї у першій колонці */}
                  {isIdeaCol && (
                    <div
                      onClick={() => onEdit(idea)}
                      className="mb-2 p-2 rounded-lg bg-amber-950/30 hover:bg-amber-900/30 border border-amber-900/30 cursor-pointer transition"
                    >
                      {idea.description ? (
                        <p className="text-amber-200/60 text-[11px] leading-relaxed line-clamp-5">{idea.description}</p>
                      ) : (
                        <p className="text-amber-900/60 text-[11px] italic">Додати опис...</p>
                      )}
                      <p className="text-amber-900/50 text-[10px] mt-1">{new Date(idea.createdAt).toLocaleDateString("uk-UA")}</p>
                    </div>
                  )}

                  {/* Задачі цієї колонки */}
                  {colTasks.map((task) => (
                    <SwimlaneTaskCard
                      key={task._id}
                      task={task}
                      categories={categories}
                      collapsed={collapsedTasks.has(String(task._id))}
                      onCollapse={(e) => { e.stopPropagation(); onToggleTask(task._id); }}
                      onEdit={onEdit}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      isReady={isActive}
                    />
                  ))}

                  {/* Кнопка + */}
                  <button
                    onClick={() => onAdd(col.id)}
                    className="w-full text-gray-700 hover:text-gray-500 text-xs py-1 mt-0.5 rounded hover:bg-gray-800/30 transition"
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── Тіло: мобільний — таби ───────────────────────── */}
          <div className="md:hidden border-t border-amber-800/20">
            <div className="flex border-b border-gray-800/60">
              {COLUMNS.map((col) => {
                const cnt = col.id === "idea" ? 1 : linkedTasks.filter((t) => t.column === col.id).length;
                return (
                  <button
                    key={col.id}
                    onClick={() => setMobileTab(col.id)}
                    className={`flex-1 px-1 py-2 text-[10px] border-b-2 transition ${
                      mobileTab === col.id ? "border-amber-500 text-white" : "border-transparent text-gray-600"
                    }`}
                  >
                    {col.label.split(" ")[0]} <span className="text-gray-700">{cnt > 0 ? cnt : ""}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-2">
              {mobileTab === "idea" && (
                <div onClick={() => onEdit(idea)} className="p-2 rounded-lg bg-amber-950/30 border border-amber-900/30 cursor-pointer mb-2">
                  <p className="text-amber-200/60 text-xs leading-relaxed">
                    {idea.description || <span className="italic text-amber-900/60">Без опису</span>}
                  </p>
                </div>
              )}
              {linkedTasks.filter((t) => t.column === mobileTab).map((task) => (
                <SwimlaneTaskCard
                  key={task._id}
                  task={task}
                  categories={categories}
                  collapsed={collapsedTasks.has(String(task._id))}
                  onCollapse={() => onToggleTask(task._id)}
                  onEdit={onEdit}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  isReady={isActive}
                />
              ))}
              <button onClick={() => onAdd(mobileTab)} className="w-full text-gray-700 text-xs py-2">+</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Проста колонка для незгрупованих задач ─────────────────────
function SimpleColumn({ col, tasks, allTasks, categories, onAdd, onEdit, onDrop, onDragStart, onDragEnd, isDragOver, onDragOver, onDragLeave }) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-gray-500 text-xs font-medium">{col.label}</span>
        <button onClick={() => onAdd(col.id)} className="text-gray-600 hover:text-gray-400 text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-gray-800 transition">+</button>
      </div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, col.id)}
        className={`flex flex-col gap-2 flex-1 min-h-[60px] rounded-xl p-1.5 transition-colors ${
          isDragOver ? "bg-blue-900/20 border border-blue-500/40 border-dashed" : "bg-gray-900/20 border border-transparent"
        }`}
      >
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} categories={categories} allTasks={allTasks} onEdit={onEdit} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        ))}
      </div>
    </div>
  );
}

// ── Головна сторінка ───────────────────────────────────────────
export default function KanbanPage() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [showCats, setShowCats] = useState(false);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [dragOverIdeaId, setDragOverIdeaId] = useState(null);
  const [collapsedIdeas, setCollapsedIdeas] = useState(new Set());
  const [collapsedTasks, setCollapsedTasks] = useState(new Set());
  const dragTask = useRef(null);

  async function load() {
    const [t, c] = await Promise.all([api.getTasks(), api.getCategories()]);
    setTasks(t);
    setCategories(c);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Collapse ────────────────────────────────────────────────
  function toggleIdea(id) {
    setCollapsedIdeas((prev) => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  }
  function toggleTask(id) {
    setCollapsedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  }

  // ── Drag & Drop ────────────────────────────────────────────
  function handleDragStart(e, task) {
    dragTask.current = task;
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragEnd() {
    dragTask.current = null;
    setDragOverCol(null);
    setDragOverIdeaId(null);
  }
  function handleDragOver(e, colId, ideaId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
    setDragOverIdeaId(ideaId || null);
  }
  function handleDragLeave() {
    setDragOverCol(null);
    setDragOverIdeaId(null);
  }

  async function handleDrop(e, colId) {
    e.preventDefault();
    setDragOverCol(null);
    setDragOverIdeaId(null);
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
  function openNew(colId, defaultType) {
    setModal({ task: { column: colId, type: defaultType || "task" } });
  }
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

  // ── Групування задач ────────────────────────────────────────
  // Ідеї, що ще не в архіві — відображаються як swimlane
  const activeIdeas = tasks
    .filter((t) => t.type === "idea" && t.column !== "archive")
    .sort((a, b) => a.order - b.order);

  // Ідентифікатори задач, які вже прив'язані до якоїсь ідеї
  const linkedToIdeaIds = new Set(
    activeIdeas.flatMap((idea) => (idea.linkedTasks || []).map(String))
  );

  // Задачі без прив'язки до активних ідей (архівні ідеї + незгруповані)
  const ungroupedTasks = tasks
    .filter((t) => !linkedToIdeaIds.has(String(t._id)) && t.type !== "idea")
    .sort((a, b) => a.order - b.order);

  // Архівні ідеї теж відображаємо як звичайні картки в ungrouped
  const archivedIdeas = tasks
    .filter((t) => t.type === "idea" && t.column === "archive")
    .sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      {/* Хедер */}
      <AppHeader activePage="kanban" constrained />

      {/* Тулбар */}
      <div className="border-b border-gray-800">
        <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center gap-4">
          <button
            onClick={() => setShowCats(true)}
            className="text-gray-400 hover:text-white text-xs transition"
          >
            ⚙ Категорії
          </button>
          <button
            onClick={() => openNew("idea", "idea")}
            className="text-amber-500 hover:text-amber-300 text-xs transition"
          >
            + Нова ідея
          </button>
          <button
            onClick={() => openNew("idea", "task")}
            className="text-blue-400 hover:text-blue-300 text-xs transition"
          >
            + Нова задача
          </button>
        </div>
      </div>

      {/* Дошка */}
      <div className="flex-1 p-3 md:p-5">
        {loading ? (
          <div className="text-gray-400 text-sm">Завантаження...</div>
        ) : (
          <div className="max-w-[1400px] mx-auto">

            {/* ── Заголовки колонок (десктоп) ─────────────────── */}
            <div className="hidden md:grid grid-cols-4 gap-0 mb-2 border border-gray-800 rounded-xl overflow-hidden">
              {COLUMNS.map((col, i) => (
                <div
                  key={col.id}
                  className={`px-3 py-2 text-xs text-gray-500 font-medium bg-gray-800/40 ${
                    i < 3 ? "border-r border-gray-800" : ""
                  }`}
                >
                  {col.label}
                </div>
              ))}
            </div>

            {/* ── Swimlane рядки для активних ідей ──────────────── */}
            {activeIdeas.map((idea) => {
              const linkedTasks = (idea.linkedTasks || [])
                .map((id) => tasks.find((t) => String(t._id) === String(id)))
                .filter(Boolean);

              return (
                <IdeaSwimlane
                  key={idea._id}
                  idea={idea}
                  linkedTasks={linkedTasks}
                  categories={categories}
                  collapsed={collapsedIdeas.has(String(idea._id))}
                  collapsedTasks={collapsedTasks}
                  onToggle={() => toggleIdea(idea._id)}
                  onToggleTask={toggleTask}
                  onEdit={openEdit}
                  onAdd={(colId) => openNew(colId)}
                  onDrop={handleDrop}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  dragOverCol={dragOverIdeaId === String(idea._id) ? dragOverCol : null}
                  onDragOver={(e, colId) => handleDragOver(e, colId, String(idea._id))}
                  onDragLeave={handleDragLeave}
                />
              );
            })}

            {/* ── Незгруповані задачі ────────────────────────────── */}
            {(ungroupedTasks.length > 0 || archivedIdeas.length > 0) && (
              <div className="mt-4">
                {(activeIdeas.length > 0) && (
                  <p className="text-gray-600 text-xs mb-2 px-1">Інші задачі</p>
                )}
                {/* Десктоп: 4 колонки */}
                <div className="hidden md:grid grid-cols-4 gap-3">
                  {COLUMNS.map((col) => {
                    const colTasks = [
                      ...ungroupedTasks.filter((t) => t.column === col.id),
                      ...archivedIdeas.filter((t) => t.column === col.id),
                    ];
                    return (
                      <SimpleColumn
                        key={col.id}
                        col={col}
                        tasks={colTasks}
                        allTasks={tasks}
                        categories={categories}
                        onAdd={() => openNew(col.id)}
                        onEdit={openEdit}
                        onDrop={handleDrop}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isDragOver={dragOverCol === col.id && !dragOverIdeaId}
                        onDragOver={(e) => handleDragOver(e, col.id, null)}
                        onDragLeave={handleDragLeave}
                      />
                    );
                  })}
                </div>
                {/* Мобільний: прокручуваний список */}
                <div className="md:hidden flex flex-col gap-2">
                  {[...ungroupedTasks, ...archivedIdeas].map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      categories={categories}
                      allTasks={tasks}
                      onEdit={openEdit}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                  <button
                    onClick={() => openNew("idea")}
                    className="w-full py-3 text-gray-600 hover:text-gray-400 text-sm border border-dashed border-gray-800 hover:border-gray-700 rounded-xl transition"
                  >
                    + Додати задачу
                  </button>
                </div>
              </div>
            )}

            {/* Порожній стан */}
            {activeIdeas.length === 0 && ungroupedTasks.length === 0 && archivedIdeas.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-600 text-sm mb-4">Дошка порожня</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => openNew("idea", "idea")}
                    className="px-4 py-2 text-sm bg-amber-900/40 hover:bg-amber-900/60 text-amber-400 border border-amber-800/40 rounded-lg transition"
                  >
                    💡 Додати ідею
                  </button>
                  <button
                    onClick={() => openNew("idea", "task")}
                    className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
                  >
                    ✦ Додати задачу
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модальне вікно задачі */}
      {modal && (
        <TaskModal
          task={modal.task}
          categories={categories}
          allTasks={tasks}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
          onOpenTask={(t) => setModal({ task: t })}
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
