import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/useAuthStore";
import { api } from "../../src/services/api";

function MessageBubble({ msg, myId }) {
  const isOwn = msg.senderId === myId;
  const time = new Date(msg.createdAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  const name = msg.senderEmail?.split("@")[0];
  return (
    <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
      {!isOwn && <Text style={s.bubbleName}>{name}</Text>}
      <Text style={s.bubbleText}>{msg.text}</Text>
      <Text style={s.bubbleTime}>{time}</Text>
    </View>
  );
}

function UserPicker({ visible, onClose, onSelect }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!visible) return;
    api.getChatUsers(search).then(setUsers).catch(console.error);
  }, [visible, search]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#111827" }}>
        <View style={s.pickerHeader}>
          <TouchableOpacity onPress={onClose}><Text style={s.pickerClose}>✕</Text></TouchableOpacity>
          <Text style={s.pickerTitle}>Новий діалог</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ padding: 12 }}>
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Пошук за email..."
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
          />
        </View>
        <ScrollView contentContainerStyle={{ padding: 12, gap: 6 }}>
          {users.map((u) => (
            <TouchableOpacity key={u._id} style={s.userItem} onPress={() => { onSelect(u); onClose(); }}>
              <Text style={s.userEmail}>👤 {u.email}</Text>
            </TouchableOpacity>
          ))}
          {users.length === 0 && (
            <Text style={{ color: "#6b7280", textAlign: "center", marginTop: 20 }}>Не знайдено</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function ChatScreen() {
  const user = useAuthStore((s) => s.user);
  const myId = user?._id;

  const [selectedUser, setSelectedUser] = useState(null); // null = загальний чат
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [unread, setUnread] = useState({});
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const listRef = useRef(null);
  const intervalRef = useRef(null);

  // Список юзерів + непрочитані
  useEffect(() => {
    api.getChatUsers().then(setUsers).catch(console.error);
    const t = setInterval(() => {
      api.getChatUnread().then((data) => {
        const map = {};
        data.forEach((d) => { map[d._id] = d.count; });
        setUnread(map);
      }).catch(console.error);
    }, 10000);
    api.getChatUnread().then((data) => {
      const map = {};
      data.forEach((d) => { map[d._id] = d.count; });
      setUnread(map);
    }).catch(console.error);
    return () => clearInterval(t);
  }, []);

  const loadMessages = useCallback(() => {
    api.getChatMessages(selectedUser?._id)
      .then((data) => {
        setMessages(data);
        setLoading(false);
        if (selectedUser) setUnread((prev) => ({ ...prev, [selectedUser._id]: 0 }));
      })
      .catch((err) => { console.error("Chat load:", err.message); setLoading(false); });
  }, [selectedUser]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    loadMessages();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(loadMessages, 3000);
    return () => clearInterval(intervalRef.current);
  }, [loadMessages]);

  async function send() {
    const msg = text.trim();
    if (!msg || sending) return;
    setText("");
    setSending(true);
    try {
      const newMsg = await api.sendChatMessage(msg, selectedUser?._id);
      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      setText(msg);
      console.error("Chat send:", err.message);
    } finally {
      setSending(false);
    }
  }

  const title = selectedUser ? `💬 ${selectedUser.email.split("@")[0]}` : "💬 Загальний чат";

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", paddingRight: 8 }}>
            <TouchableOpacity
              style={[s.tab, !selectedUser && s.tabActive]}
              onPress={() => setSelectedUser(null)}
            >
              <Text style={[s.tabText, !selectedUser && s.tabTextActive]}>💬 Загальний</Text>
            </TouchableOpacity>
            {users.map((u) => {
              const unreadCount = unread[u._id] || 0;
              const isActive = selectedUser?._id === u._id;
              return (
                <TouchableOpacity
                  key={u._id}
                  style={[s.tab, isActive && s.tabActive]}
                  onPress={() => setSelectedUser(u)}
                >
                  <Text style={[s.tabText, isActive && s.tabTextActive]}>
                    {u.email.split("@")[0]}
                  </Text>
                  {unreadCount > 0 && (
                    <View style={s.badge}><Text style={s.badgeText}>{unreadCount}</Text></View>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={s.tab} onPress={() => setShowPicker(true)}>
              <Text style={s.tabText}>+ Новий</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m._id}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => <MessageBubble msg={item} myId={myId} />}
          ListEmptyComponent={
            !loading && <Text style={s.empty}>Немає повідомлень. Напишіть перше!</Text>
          }
        />

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Повідомлення..."
            placeholderTextColor="#6b7280"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.sendIcon}>▶</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <UserPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(u) => {
          if (!users.find((x) => x._id === u._id)) setUsers((prev) => [...prev, u]);
          setSelectedUser(u);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  header: { borderBottomWidth: 1, borderBottomColor: "#374151", paddingVertical: 6, paddingLeft: 12 },
  tab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: "#1f2937", flexDirection: "row", alignItems: "center", gap: 4 },
  tabActive: { backgroundColor: "#1d4ed8" },
  tabText: { color: "#9ca3af", fontSize: 12 },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  badge: { backgroundColor: "#ef4444", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { color: "#fff", fontSize: 10 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 40, fontSize: 14 },
  bubble: { maxWidth: "80%", borderRadius: 14, padding: 10, gap: 2 },
  bubbleOwn: { alignSelf: "flex-end", backgroundColor: "#1d4ed8" },
  bubbleOther: { alignSelf: "flex-start", backgroundColor: "#1f2937", borderWidth: 1, borderColor: "#374151" },
  bubbleName: { color: "#3b82f6", fontSize: 11, fontWeight: "600" },
  bubbleText: { color: "#fff", fontSize: 14 },
  bubbleTime: { color: "rgba(255,255,255,0.4)", fontSize: 10, alignSelf: "flex-end" },
  inputRow: { flexDirection: "row", padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: "#374151", alignItems: "flex-end" },
  input: { flex: 1, backgroundColor: "#1f2937", color: "#fff", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: "#374151", maxHeight: 100 },
  sendBtn: { backgroundColor: "#3b82f6", width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: "#fff", fontSize: 14 },
  // UserPicker
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#374151" },
  pickerClose: { color: "#9ca3af", fontSize: 18 },
  pickerTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  searchInput: { backgroundColor: "#1f2937", color: "#fff", borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1, borderColor: "#374151" },
  userItem: { backgroundColor: "#1f2937", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#374151" },
  userEmail: { color: "#fff", fontSize: 14 },
});
