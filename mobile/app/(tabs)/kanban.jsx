import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/services/api";
import { useSettingsStore } from "../../src/store/useSettingsStore";

const COLUMNS = [
  { key: "idea",         label: "💡 Ідеї" },
  { key: "in-progress",  label: "🔨 В роботі" },
  { key: "done",         label: "✅ Готово" },
  { key: "archive",      label: "🗄️ Архів" },
];

const COL_COLORS = {
  "idea":        "#d97706",
  "in-progress": "#3b82f6",
  "done":        "#22c55e",
  "archive":     "#6b7280",
};

const PRIORITIES = [
  { key: "critical", label: "🔴 Критично" },
  { key: "high",     label: "🟠 Високий" },
  { key: "medium",   label: "🟡 Середній" },
  { key: "low",      label: "🟢 Низький" },
];

const TASK_TYPES = [
  { key: "idea",    label: "💡 Ідея",      color: "#92400e" },
  { key: "task",    label: "✦ Задача",     color: "#1e3a8a" },
  { key: "subtask", label: "↳ Підзадача",  color: "#374151" },
];

function priorityIcon(p) {
  return p === "critical" ? "🔴" : p === "high" ? "🟠" : p === "low" ? "🟢" : "🟡";
}

function TaskCard({ task, onPress, showStatus }) {
  const isIdea    = task.type === "idea";
  const isSubtask = task.type === "subtask";
  return (
    <TouchableOpacity
      style={[s.taskCard, isIdea && s.taskCardIdea, isSubtask && s.taskCardSubtask]}
      onPress={() => onPress(task)}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 2 }}>
          {isIdea    && <Text style={s.taskTypeLabel}>💡 Ідея</Text>}
          {isSubtask && <Text style={[s.taskTypeLabel, { color: "#9ca3af" }]}>↳ Підзадача</Text>}
          <Text style={s.taskTitle} numberOfLines={2}>{task.title}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {showStatus && task.column && (
            <Text style={[s.statusChip, { color: COL_COLORS[task.column] || "#6b7280" }]}>
              {COLUMNS.find((c) => c.key === task.column)?.label ?? task.column}
            </Text>
          )}
          <Text>{priorityIcon(task.priority)}</Text>
        </View>
      </View>
      {task.category ? <Text style={s.taskCategory}>{task.category}</Text> : null}
      {task.description ? <Text style={s.taskDesc} numberOfLines={2}>{task.description}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
        {task.comments?.length  > 0 && <Text style={s.taskMeta}>💬 {task.comments.length}</Text>}
        {task.linkedTasks?.length > 0 && <Text style={s.taskMeta}>🔗 {task.linkedTasks.length}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function IdeaRow({ idea, linkedTasks, collapsed, onToggle, onPress }) {
  const byStatus = {};
  COLUMNS.forEach((c) => { byStatus[c.key] = linkedTasks.filter((t) => t.column === c.key); });

  return (
    <View style={s.ideaRow}>
      {/* Заголовок ідеї */}
      <TouchableOpacity style={s.ideaHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={s.ideaCollapse}>{collapsed ? "▶" : "▼"}</Text>
            <Text style={s.ideaTitle} numberOfLines={1}>{idea.title}</Text>
            <Text>{priorityIcon(idea.priority)}</Text>
          </View>
          {/* Міні-статистика по статусах */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
            {COLUMNS.filter((c) => c.key !== "archive").map((c) => {
              const cnt = byStatus[c.key]?.length ?? 0;
              if (cnt === 0) return null;
              return (
                <Text key={c.key} style={[s.ideaStatChip, { color: COL_COLORS[c.key] }]}>
                  {c.label} {cnt}
                </Text>
              );
            })}
            {linkedTasks.length === 0 && (
              <Text style={s.ideaStatChip}>Без задач</Text>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => onPress(idea)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: "#6b7280", fontSize: 20, lineHeight: 24 }}>···</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Пов'язані задачі */}
      {!collapsed && (
        <View style={s.ideaTasks}>
          {linkedTasks.length === 0 ? (
            <Text style={[s.empty, { marginTop: 6, marginBottom: 4, fontSize: 12 }]}>Немає пов'язаних задач</Text>
          ) : (
            linkedTasks.map((t) => (
              <TaskCard key={t._id} task={t} onPress={onPress} showStatus />
            ))
          )}
        </View>
      )}
    </View>
  );
}

function TaskModal({ task, categories, onClose, onSave, onDelete }) {
  const defaultType = task?._defaultType ?? task?.type ?? "task";
  const [title,      setTitle]      = useState(task?.title       ?? "");
  const [desc,       setDesc]       = useState(task?.description ?? "");
  const [column,     setColumn]     = useState(task?.column      ?? "idea");
  const [priority,   setPriority]   = useState(task?.priority    ?? "medium");
  const [type,       setType]       = useState(defaultType);
  const [category,   setCategory]   = useState(task?.category    ?? "");
  const [newComment, setNewComment] = useState("");
  const [comments,   setComments]   = useState(task?.comments    ?? []);
  const [saving,     setSaving]     = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: desc, column, priority, type, category });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!newComment.trim() || !task?._id) return;
    try {
      const updated = await api.addComment(task._id, newComment.trim());
      setComments(updated.comments ?? []);
      setNewComment("");
    } catch {}
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#111827" }}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
          <Text style={s.modalTitle}>{task?._id ? "Редагувати" : "Нова задача"}</Text>
          <TouchableOpacity onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#3b82f6" /> : <Text style={s.modalSave}>Зберегти</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          {/* Тип */}
          <View>
            <Text style={s.fieldLabel}>Тип</Text>
            <View style={s.row}>
              {TASK_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[s.chip, type === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                  onPress={() => setType(t.key)}
                >
                  <Text style={[s.chipText, type === t.key && s.chipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Назва"
            placeholderTextColor="#6b7280"
          />
          <TextInput
            style={[s.input, { minHeight: 80, textAlignVertical: "top" }]}
            value={desc}
            onChangeText={setDesc}
            placeholder={type === "idea" ? "Опис ідеї (контекст, мета, деталі)..." : "Опис..."}
            placeholderTextColor="#6b7280"
            multiline
          />

          {/* Статус */}
          <View>
            <Text style={s.fieldLabel}>Статус</Text>
            <View style={s.row}>
              {COLUMNS.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[s.chip, column === c.key && s.chipActive]}
                  onPress={() => setColumn(c.key)}
                >
                  <Text style={[s.chipText, column === c.key && s.chipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Пріоритет */}
          <View>
            <Text style={s.fieldLabel}>Пріоритет</Text>
            <View style={s.row}>
              {PRIORITIES.map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[s.chip, priority === key && s.chipActive]}
                  onPress={() => setPriority(key)}
                >
                  <Text style={[s.chipText, priority === key && s.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Категорія */}
          {categories.length > 0 && (
            <View>
              <Text style={s.fieldLabel}>Категорія</Text>
              <View style={s.row}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[s.chip, category === c && s.chipActive]}
                    onPress={() => setCategory(category === c ? "" : c)}
                  >
                    <Text style={[s.chipText, category === c && s.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Коментарі */}
          {task?._id && (
            <View>
              <Text style={s.fieldLabel}>Коментарі</Text>
              {comments.map((c) => (
                <View key={c._id} style={s.comment}>
                  <Text style={s.commentText}>{c.text}</Text>
                  <Text style={s.commentDate}>{new Date(c.createdAt).toLocaleString("uk-UA")}</Text>
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder="Новий коментар..."
                  placeholderTextColor="#6b7280"
                />
                <TouchableOpacity style={s.addCommentBtn} onPress={addComment}>
                  <Text style={{ color: "#fff" }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {task?._id && (
            <TouchableOpacity
              style={s.deleteBtn}
              onPress={() => { onDelete(task._id); onClose(); }}
            >
              <Text style={{ color: "#f87171", fontWeight: "600" }}>🗑 Видалити задачу</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function KanbanScreen() {
  const localOnline = useSettingsStore((s) => s.localOnline);
  const [tasks,          setTasks]          = useState([]);
  const [categories,     setCategories]     = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [error,          setError]          = useState(null);
  const [viewMode,       setViewMode]       = useState("swimlane"); // "swimlane" | "column"
  const [activeCol,      setActiveCol]      = useState("in-progress");
  const [collapsedIdeas, setCollapsedIdeas] = useState(new Set());
  const [modalTask,      setModalTask]      = useState(null);
  const [showModal,      setShowModal]      = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [t, c] = await Promise.all([api.getTasks(), api.getCategories()]);
      setTasks(Array.isArray(t) ? t : []);
      setCategories(Array.isArray(c) ? c : []);
    } catch (err) {
      console.error("Kanban load error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (localOnline === false) { setLoading(false); return; }
    setLoading(true);
    load();
  }, [load, localOnline]);

  // Групування (та сама логіка як у web)
  const activeIdeas = tasks
    .filter((t) => t.type === "idea" && t.column !== "archive")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const linkedToIdeaIds = new Set(
    activeIdeas.flatMap((idea) => (idea.linkedTasks ?? []).map(String))
  );

  const ungroupedTasks = tasks
    .filter((t) => !linkedToIdeaIds.has(String(t._id)) && t.type !== "idea" && t.column !== "archive")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const archivedItems = tasks
    .filter((t) => t.column === "archive")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  function getLinkedTasks(idea) {
    const ids = (idea.linkedTasks ?? []).map(String);
    return tasks.filter((t) => ids.includes(String(t._id)));
  }

  function toggleIdea(id) {
    setCollapsedIdeas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openNew(type = "task") {
    setModalTask({ _defaultType: type });
    setShowModal(true);
  }
  function openTask(task) { setModalTask(task); setShowModal(true); }

  async function saveTask(data) {
    if (modalTask?._id) {
      await api.updateTask(modalTask._id, data);
    } else {
      await api.createTask(data);
    }
    await load();
  }

  async function deleteTask(id) {
    await api.deleteTask(id);
    await load();
  }

  const colTasks = tasks.filter((t) => t.column === activeCol);

  return (
    <SafeAreaView style={s.container}>
      {/* Хедер */}
      <View style={s.header}>
        <Text style={s.headerTitle}>📋 Канбан</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={s.addBtnIdea} onPress={() => openNew("idea")}>
            <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "600" }}>+ Ідея</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={() => openNew("task")}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>+ Задача</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Перемикач режиму */}
      <View style={s.viewToggle}>
        <TouchableOpacity
          style={[s.toggleBtn, viewMode === "swimlane" && s.toggleBtnActive]}
          onPress={() => setViewMode("swimlane")}
        >
          <Text style={[s.toggleText, viewMode === "swimlane" && s.toggleTextActive]}>🏊 Swimlane</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, viewMode === "column" && s.toggleBtnActive]}
          onPress={() => setViewMode("column")}
        >
          <Text style={[s.toggleText, viewMode === "column" && s.toggleTextActive]}>📑 Колонки</Text>
        </TouchableOpacity>
      </View>

      {/* Таби колонок (тільки в column mode) */}
      {viewMode === "column" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.tabs}
          contentContainerStyle={{ gap: 4, paddingHorizontal: 16, alignItems: "center" }}
        >
          {COLUMNS.map((c) => {
            const count = tasks.filter((t) => t.column === c.key).length;
            return (
              <TouchableOpacity
                key={c.key}
                style={[s.tab, activeCol === c.key && s.tabActive]}
                onPress={() => setActiveCol(c.key)}
              >
                <Text style={[s.tabText, activeCol === c.key && s.tabTextActive]}>{c.label}</Text>
                {count > 0 && (
                  <View style={s.tabBadge}><Text style={s.tabBadgeText}>{count}</Text></View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Офлайн банер */}
      {localOnline === false && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineText}>📡 Локальний сервер недоступний</Text>
          <Text style={s.offlineHint}>Канбан доступний тільки в домашній мережі</Text>
        </View>
      )}

      {/* Помилка */}
      {error && localOnline !== false && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>❌ {error}</Text>
          <TouchableOpacity onPress={load} style={s.retryBtn}>
            <Text style={{ color: "#3b82f6", fontSize: 13 }}>Повторити</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Завантаження */}
      {loading && localOnline !== false && (
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <ActivityIndicator color="#3b82f6" />
        </View>
      )}

      {/* Вміст */}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#3b82f6"
          />
        }
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 }}
      >
        {viewMode === "swimlane" ? (
          <>
            {activeIdeas.length === 0 && ungroupedTasks.length === 0 && !loading && localOnline !== false && (
              <Text style={s.empty}>Немає активних ідей та задач</Text>
            )}

            {/* Ідеї зі своїми задачами */}
            {activeIdeas.map((idea) => (
              <IdeaRow
                key={idea._id}
                idea={idea}
                linkedTasks={getLinkedTasks(idea)}
                collapsed={collapsedIdeas.has(String(idea._id))}
                onToggle={() => toggleIdea(String(idea._id))}
                onPress={openTask}
              />
            ))}

            {/* Незгруповані задачі */}
            {ungroupedTasks.length > 0 && (
              <>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>Інші задачі</Text>
                </View>
                {ungroupedTasks.map((t) => (
                  <TaskCard key={t._id} task={t} onPress={openTask} showStatus />
                ))}
              </>
            )}

            {/* Архів */}
            {archivedItems.length > 0 && (
              <>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>🗄️ Архів ({archivedItems.length})</Text>
                </View>
                {archivedItems.map((t) => (
                  <TaskCard key={t._id} task={t} onPress={openTask} />
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {!loading && !error && colTasks.length === 0 && localOnline !== false && (
              <Text style={s.empty}>Немає задач</Text>
            )}
            {colTasks.map((t) => (
              <TaskCard key={t._id} task={t} onPress={openTask} />
            ))}
          </>
        )}
      </ScrollView>

      {showModal && (
        <TaskModal
          task={modalTask}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#111827" },

  // Хедер
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#374151" },
  headerTitle:  { fontSize: 18, fontWeight: "700", color: "#fff" },
  addBtn:       { backgroundColor: "#1d4ed8", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnIdea:   { backgroundColor: "#78350f", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },

  // Перемикач режиму
  viewToggle:       { flexDirection: "row", backgroundColor: "#1f2937", margin: 12, borderRadius: 12, padding: 3, gap: 3 },
  toggleBtn:        { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: "center" },
  toggleBtnActive:  { backgroundColor: "#374151" },
  toggleText:       { color: "#6b7280", fontSize: 13 },
  toggleTextActive: { color: "#fff", fontWeight: "600" },

  // Таби колонок
  tabs:         { borderBottomWidth: 1, borderBottomColor: "#374151", paddingVertical: 6, maxHeight: 52, flexGrow: 0 },
  tab:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#1f2937", flexDirection: "row", alignItems: "center", gap: 4 },
  tabActive:    { backgroundColor: "#1d4ed8" },
  tabText:      { color: "#9ca3af", fontSize: 13 },
  tabTextActive:{ color: "#fff", fontWeight: "600" },
  tabBadge:     { backgroundColor: "#374151", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { color: "#9ca3af", fontSize: 10 },

  // Swimlane — ідея
  ideaRow:      { borderRadius: 14, borderWidth: 1, borderColor: "#78350f", backgroundColor: "#1c1204", overflow: "hidden" },
  ideaHeader:   { flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
  ideaCollapse: { color: "#d97706", fontSize: 13, width: 14 },
  ideaTitle:    { flex: 1, color: "#fcd34d", fontSize: 14, fontWeight: "700" },
  ideaStatChip: { fontSize: 11, fontWeight: "600" },
  ideaTasks:    { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },

  // Секції
  sectionHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 4, gap: 8 },
  sectionTitle:  { color: "#6b7280", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },

  // Картки задач
  taskCard:       { backgroundColor: "#1f2937", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#374151", gap: 4 },
  taskCardIdea:   { backgroundColor: "#1c1204", borderColor: "#78350f" },
  taskCardSubtask:{ backgroundColor: "#18181b", borderColor: "#374151", marginLeft: 12, borderLeftWidth: 3, borderLeftColor: "#4b5563" },
  taskTypeLabel:  { color: "#d97706", fontSize: 11, fontWeight: "600" },
  taskTitle:      { color: "#fff", fontSize: 14, fontWeight: "600" },
  taskDesc:       { color: "#6b7280", fontSize: 12, lineHeight: 18 },
  taskCategory:   { color: "#3b82f6", fontSize: 11 },
  taskMeta:       { color: "#6b7280", fontSize: 11 },
  statusChip:     { fontSize: 11, fontWeight: "600" },

  // Порожньо / офлайн / помилка
  empty:        { color: "#6b7280", textAlign: "center", marginTop: 40, fontSize: 14 },
  offlineBanner:{ backgroundColor: "#1c1f2e", margin: 12, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#374151", alignItems: "center", gap: 4 },
  offlineText:  { color: "#f59e0b", fontSize: 14, fontWeight: "600" },
  offlineHint:  { color: "#6b7280", fontSize: 12 },
  errorBanner:  { backgroundColor: "#2d1515", margin: 12, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#7f1d1d", alignItems: "center", gap: 8 },
  errorText:    { color: "#f87171", fontSize: 13 },
  retryBtn:     { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#3b82f6" },

  // Модалка
  modalHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#374151" },
  modalClose:   { color: "#9ca3af", fontSize: 18 },
  modalTitle:   { color: "#fff", fontWeight: "700", fontSize: 16 },
  modalSave:    { color: "#3b82f6", fontWeight: "600", fontSize: 15 },
  input:        { backgroundColor: "#1f2937", color: "#fff", borderRadius: 12, padding: 12, fontSize: 14, borderWidth: 1, borderColor: "#374151" },
  fieldLabel:   { color: "#9ca3af", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  row:          { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: "#1f2937", borderWidth: 1, borderColor: "#374151" },
  chipActive:   { backgroundColor: "#1d4ed8", borderColor: "#3b82f6" },
  chipText:     { color: "#9ca3af", fontSize: 12 },
  chipTextActive:{ color: "#fff" },
  comment:      { backgroundColor: "#1f2937", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#374151", marginBottom: 6 },
  commentText:  { color: "#e5e7eb", fontSize: 13 },
  commentDate:  { color: "#6b7280", fontSize: 11, marginTop: 4 },
  addCommentBtn:{ backgroundColor: "#3b82f6", borderRadius: 12, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" },
  deleteBtn:    { alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#7f1d1d", marginTop: 8 },
});
