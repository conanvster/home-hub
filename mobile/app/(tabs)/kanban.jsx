import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, RefreshControl, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/services/api";

const COLUMNS = [
  { key: "idea",        label: "💡 Ідеї" },
  { key: "in-progress", label: "🔨 В роботі" },
  { key: "done",        label: "✅ Готово" },
  { key: "archive",     label: "🗄️ Архів" },
];

const PRIORITY_LABELS = { high: "🔴", medium: "🟡", low: "🟢" };

function TaskCard({ task, onPress }) {
  return (
    <TouchableOpacity style={s.taskCard} onPress={() => onPress(task)}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={s.taskTitle} numberOfLines={2}>{task.title}</Text>
        <Text>{PRIORITY_LABELS[task.priority] || "⚪"}</Text>
      </View>
      {task.category && <Text style={s.taskCategory}>{task.category}</Text>}
      {task.comments?.length > 0 && (
        <Text style={s.taskMeta}>💬 {task.comments.length}</Text>
      )}
    </TouchableOpacity>
  );
}

function TaskModal({ task, categories, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(task?.title || "");
  const [desc, setDesc] = useState(task?.description || "");
  const [column, setColumn] = useState(task?.column || "idea");
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [category, setCategory] = useState(task?.category || "");
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState(task?.comments || []);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: desc, column, priority, category });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!newComment.trim() || !task?._id) return;
    try {
      const updated = await api.addComment(task._id, newComment.trim());
      setComments(updated.comments || []);
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

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Назва" placeholderTextColor="#6b7280" />
          <TextInput style={[s.input, { height: 80, textAlignVertical: "top" }]} value={desc} onChangeText={setDesc} placeholder="Опис" placeholderTextColor="#6b7280" multiline />

          {/* Column */}
          <Text style={s.fieldLabel}>Колонка</Text>
          <View style={s.row}>
            {COLUMNS.map((c) => (
              <TouchableOpacity key={c.key} style={[s.chip, column === c.key && s.chipActive]} onPress={() => setColumn(c.key)}>
                <Text style={[s.chipText, column === c.key && s.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Priority */}
          <Text style={s.fieldLabel}>Пріоритет</Text>
          <View style={s.row}>
            {[["high","🔴 Високий"],["medium","🟡 Середній"],["low","🟢 Низький"]].map(([k,l]) => (
              <TouchableOpacity key={k} style={[s.chip, priority === k && s.chipActive]} onPress={() => setPriority(k)}>
                <Text style={[s.chipText, priority === k && s.chipTextActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Category */}
          <Text style={s.fieldLabel}>Категорія</Text>
          <View style={s.row}>
            {categories.map((c) => (
              <TouchableOpacity key={c} style={[s.chip, category === c && s.chipActive]} onPress={() => setCategory(category === c ? "" : c)}>
                <Text style={[s.chipText, category === c && s.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Comments */}
          {task?._id && (
            <>
              <Text style={s.fieldLabel}>Коментарі</Text>
              {comments.map((c) => (
                <View key={c._id} style={s.comment}>
                  <Text style={s.commentText}>{c.text}</Text>
                  <Text style={s.commentDate}>{new Date(c.createdAt).toLocaleString("uk-UA")}</Text>
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput style={[s.input, { flex: 1 }]} value={newComment} onChangeText={setNewComment} placeholder="Новий коментар..." placeholderTextColor="#6b7280" />
                <TouchableOpacity style={s.addCommentBtn} onPress={addComment}>
                  <Text style={{ color: "#fff" }}>+</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {task?._id && (
            <TouchableOpacity style={s.deleteBtn} onPress={() => { onDelete(task._id); onClose(); }}>
              <Text style={{ color: "#f87171", fontWeight: "600" }}>🗑 Видалити задачу</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function KanbanScreen() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCol, setActiveCol] = useState("idea");
  const [modalTask, setModalTask] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([api.getTasks(), api.getCategories()]);
      setTasks(t);
      setCategories(c);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const colTasks = tasks.filter((t) => t.column === activeCol);

  function openNew() { setModalTask(null); setShowModal(true); }
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

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>📋 Канбан</Text>
        <TouchableOpacity style={s.addBtn} onPress={openNew}>
          <Text style={{ color: "#fff", fontSize: 20 }}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Column tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs} contentContainerStyle={{ gap: 4, paddingHorizontal: 16 }}>
        {COLUMNS.map((c) => {
          const count = tasks.filter((t) => t.column === c.key).length;
          return (
            <TouchableOpacity
              key={c.key}
              style={[s.tab, activeCol === c.key && s.tabActive]}
              onPress={() => setActiveCol(c.key)}
            >
              <Text style={[s.tabText, activeCol === c.key && s.tabTextActive]}>{c.label}</Text>
              {count > 0 && <View style={s.tabBadge}><Text style={s.tabBadgeText}>{count}</Text></View>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />}
        contentContainerStyle={{ padding: 16, gap: 8 }}
      >
        {colTasks.length === 0 && !loading && (
          <Text style={s.empty}>Немає задач</Text>
        )}
        {colTasks.map((t) => <TaskCard key={t._id} task={t} onPress={openTask} />)}
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
  container: { flex: 1, backgroundColor: "#111827" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#374151" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  addBtn: { backgroundColor: "#3b82f6", width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  tabs: { borderBottomWidth: 1, borderBottomColor: "#374151", paddingVertical: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#1f2937", flexDirection: "row", alignItems: "center", gap: 4 },
  tabActive: { backgroundColor: "#1d4ed8" },
  tabText: { color: "#9ca3af", fontSize: 13 },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  tabBadge: { backgroundColor: "#374151", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { color: "#9ca3af", fontSize: 10 },
  taskCard: { backgroundColor: "#1f2937", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#374151", gap: 6 },
  taskTitle: { color: "#fff", fontSize: 14, fontWeight: "600", flex: 1 },
  taskCategory: { color: "#3b82f6", fontSize: 11 },
  taskMeta: { color: "#6b7280", fontSize: 11 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 40, fontSize: 14 },
  // Modal
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#374151" },
  modalClose: { color: "#9ca3af", fontSize: 18 },
  modalTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  modalSave: { color: "#3b82f6", fontWeight: "600", fontSize: 15 },
  input: { backgroundColor: "#1f2937", color: "#fff", borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1, borderColor: "#374151" },
  fieldLabel: { color: "#9ca3af", fontSize: 12, fontWeight: "600", marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: "#1f2937", borderWidth: 1, borderColor: "#374151" },
  chipActive: { backgroundColor: "#1d4ed8", borderColor: "#3b82f6" },
  chipText: { color: "#9ca3af", fontSize: 12 },
  chipTextActive: { color: "#fff" },
  comment: { backgroundColor: "#1f2937", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#374151" },
  commentText: { color: "#e5e7eb", fontSize: 13 },
  commentDate: { color: "#6b7280", fontSize: 11, marginTop: 4 },
  addCommentBtn: { backgroundColor: "#3b82f6", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" },
  deleteBtn: { alignItems: "center", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#7f1d1d", marginTop: 8 },
});
