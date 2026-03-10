import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useSettingsStore } from "../../src/store/useSettingsStore";
import { api } from "../../src/services/api";

const AI_USER = { _id: "ai", email: "ai@agent.local" };

function MessageBubble({ msg, myId }) {
  const isOwn = msg.senderId === myId;
  const isAI  = msg.senderId === "ai";
  const time = new Date(msg.createdAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  const name = isAI ? "🤖 AI" : msg.senderEmail?.split("@")[0];
  return (
    <View style={[s.bubble, isOwn ? s.bubbleOwn : isAI ? s.bubbleAI : s.bubbleOther]}>
      {!isOwn && <Text style={[s.bubbleName, isAI && s.bubbleNameAI]}>{name}</Text>}
      <Text style={s.bubbleText}>{msg.text}</Text>
      <Text style={s.bubbleTime}>{time}</Text>
    </View>
  );
}

function UserPicker({ visible, onClose, onSelect, isLocal }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!visible) return;
    const fn = isLocal ? api.getChatUsersLocal : api.getChatUsers;
    fn(search).then(setUsers).catch(console.error);
  }, [visible, search, isLocal]);

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
  const localOnline = useSettingsStore((s) => s.localOnline);
  const isLocal = localOnline === true;
  const isAISelected = isLocal; // AI тільки в локальному режимі — буде окремий стан нижче

  const [selectedUser, setSelectedUser] = useState(null); // null = загальний, AI_USER = AI агент
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [unread, setUnread] = useState({});
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const listRef = useRef(null);
  const intervalRef = useRef(null);

  const isAIChat = selectedUser?._id === "ai";

  // Хелпери API (автоматично local або cloud)
  const chatApi = {
    getUsers: (q) => isLocal ? api.getChatUsersLocal(q) : api.getChatUsers(q),
    getMessages: (recipientId) => isLocal ? api.getChatMessagesLocal(recipientId) : api.getChatMessages(recipientId),
    sendMessage: (text, recipientId) => isLocal ? api.sendChatMessageLocal(text, recipientId) : api.sendChatMessage(text, recipientId),
    getUnread: () => isLocal ? api.getChatUnreadLocal() : api.getChatUnread(),
  };

  // Скидаємо стан при зміні режиму (local/cloud)
  useEffect(() => {
    setSelectedUser(null);
    setMessages([]);
    setUsers([]);
    setUnread({});
  }, [isLocal]);

  // Список юзерів + непрочитані (не для AI чату)
  useEffect(() => {
    if (isAIChat) return;
    chatApi.getUsers().then(setUsers).catch(console.error);
    const loadUnread = () => {
      chatApi.getUnread().then((data) => {
        const map = {};
        data.forEach((d) => { map[d._id] = d.count; });
        setUnread(map);
      }).catch(console.error);
    };
    loadUnread();
    const t = setInterval(loadUnread, 10000);
    return () => clearInterval(t);
  }, [isLocal, isAIChat]);

  // Повідомлення
  const loadMessages = useCallback(() => {
    if (isAIChat) return;
    chatApi.getMessages(selectedUser?._id)
      .then((data) => {
        setMessages(data);
        setLoading(false);
        if (selectedUser) setUnread((prev) => ({ ...prev, [selectedUser._id]: 0 }));
      })
      .catch((err) => { console.error("Chat load:", err.message); setLoading(false); });
  }, [selectedUser, isLocal, isAIChat]);

  useEffect(() => {
    if (isAIChat) { setLoading(false); return; }
    setLoading(true);
    setMessages([]);
    loadMessages();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(loadMessages, 3000);
    return () => clearInterval(intervalRef.current);
  }, [loadMessages, isAIChat]);

  async function send() {
    const msg = text.trim();
    if (!msg || sending) return;
    setText("");
    setSending(true);

    // AI режим
    if (isAIChat) {
      const userMsg = {
        _id: `user-${Date.now()}`,
        senderId: myId,
        senderEmail: user?.email,
        text: msg,
        createdAt: new Date().toISOString(),
      };
      const currentMessages = [...messages, userMsg];
      setMessages(currentMessages);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      try {
        const { response } = await api.agentChat(msg, currentMessages);
        setMessages((prev) => [...prev, {
          _id: `ai-${Date.now()}`,
          senderId: "ai",
          senderEmail: "ai@agent.local",
          text: response,
          createdAt: new Date().toISOString(),
        }]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      } catch (err) {
        setMessages((prev) => [...prev, {
          _id: `ai-err-${Date.now()}`,
          senderId: "ai",
          senderEmail: "ai@agent.local",
          text: `❌ Помилка: ${err.message}`,
          createdAt: new Date().toISOString(),
        }]);
        setText(msg);
      } finally {
        setSending(false);
      }
      return;
    }

    // Звичайний чат
    try {
      const newMsg = await chatApi.sendMessage(msg, selectedUser?._id);
      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      setText(msg);
      console.error("Chat send:", err.message);
    } finally {
      setSending(false);
    }
  }

  function selectUser(u) {
    setSelectedUser(u);
    setMessages([]);
    setLoading(u?._id !== "ai");
  }

  return (
    <SafeAreaView style={s.container} edges={[]}>

      {/* Індикатор режиму */}
      <View style={[s.modeBanner, isLocal ? s.modeBannerLocal : s.modeBannerCloud]}>
        <Text style={s.modeBannerText}>
          {isLocal ? "🏡 Локальний режим" : "☁️ Хмарний режим"}
        </Text>
      </View>

      {/* Таби розмов */}
      <View style={s.header}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", paddingRight: 8 }}>
            <TouchableOpacity
              style={[s.tab, !selectedUser && s.tabActive]}
              onPress={() => selectUser(null)}
            >
              <Text style={[s.tabText, !selectedUser && s.tabTextActive]}>💬 Загальний</Text>
            </TouchableOpacity>

            {/* AI агент — тільки локально */}
            {isLocal && (
              <TouchableOpacity
                style={[s.tab, isAIChat && s.tabAI]}
                onPress={() => selectUser(AI_USER)}
              >
                <Text style={[s.tabText, isAIChat && s.tabTextActive]}>🤖 AI</Text>
              </TouchableOpacity>
            )}

            {users.map((u) => {
              const unreadCount = unread[u._id] || 0;
              const isActive = selectedUser?._id === u._id;
              return (
                <TouchableOpacity
                  key={u._id}
                  style={[s.tab, isActive && s.tabActive]}
                  onPress={() => selectUser(u)}
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
            {!isAIChat && (
              <TouchableOpacity style={s.tab} onPress={() => setShowPicker(true)}>
                <Text style={s.tabText}>+ Новий</Text>
              </TouchableOpacity>
            )}
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
            !loading && (
              <Text style={s.empty}>
                {isAIChat
                  ? "Привіт! Я можу:\n📋 Переглядати та створювати задачі\n🔍 Шукати інформацію в інтернеті\n💡 Допомагати з рішеннями для дому"
                  : "Немає повідомлень. Напишіть перше!"}
              </Text>
            )
          }
        />

        {/* "Думаю..." для AI */}
        {sending && isAIChat && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
            <View style={s.bubbleAI}>
              <Text style={s.bubbleNameAI}>🤖 AI</Text>
              <Text style={s.bubbleText}>Думаю...</Text>
            </View>
          </View>
        )}

        <View style={s.inputRow}>
          <TextInput
            style={[s.input, isAIChat && s.inputAI]}
            value={text}
            onChangeText={setText}
            placeholder={isAIChat ? "Запитай AI агента..." : "Повідомлення..."}
            placeholderTextColor="#6b7280"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[s.sendBtn, isAIChat && s.sendBtnAI, (!text.trim() || sending) && s.sendBtnDisabled]}
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
        isLocal={isLocal}
        onSelect={(u) => {
          if (!users.find((x) => x._id === u._id)) setUsers((prev) => [...prev, u]);
          selectUser(u);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },

  // Режим банер
  modeBanner: { paddingHorizontal: 12, paddingVertical: 4, flexDirection: "row", alignItems: "center" },
  modeBannerLocal: { backgroundColor: "#064e3b" },
  modeBannerCloud: { backgroundColor: "#1e3a5f" },
  modeBannerText: { color: "#6ee7b7", fontSize: 10, fontWeight: "600" },

  // Таби
  header: { borderBottomWidth: 1, borderBottomColor: "#374151", paddingVertical: 6, paddingLeft: 12 },
  tab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: "#1f2937", flexDirection: "row", alignItems: "center", gap: 4 },
  tabActive: { backgroundColor: "#1d4ed8" },
  tabAI: { backgroundColor: "#6b21a8" },
  tabText: { color: "#9ca3af", fontSize: 12 },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  badge: { backgroundColor: "#ef4444", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { color: "#fff", fontSize: 10 },

  // Повідомлення
  empty: { color: "#6b7280", textAlign: "center", marginTop: 40, fontSize: 14, lineHeight: 22 },
  bubble: { maxWidth: "80%", borderRadius: 14, padding: 10, gap: 2 },
  bubbleOwn: { alignSelf: "flex-end", backgroundColor: "#1d4ed8" },
  bubbleOther: { alignSelf: "flex-start", backgroundColor: "#1f2937", borderWidth: 1, borderColor: "#374151" },
  bubbleAI: { alignSelf: "flex-start", backgroundColor: "#3b0764", borderWidth: 1, borderColor: "#7e22ce" },
  bubbleName: { color: "#3b82f6", fontSize: 11, fontWeight: "600" },
  bubbleNameAI: { color: "#c084fc", fontSize: 11, fontWeight: "600" },
  bubbleText: { color: "#fff", fontSize: 14 },
  bubbleTime: { color: "rgba(255,255,255,0.4)", fontSize: 10, alignSelf: "flex-end" },

  // Введення
  inputRow: { flexDirection: "row", padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: "#374151", alignItems: "flex-end" },
  input: { flex: 1, backgroundColor: "#1f2937", color: "#fff", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: "#374151", maxHeight: 100 },
  inputAI: { borderColor: "#7e22ce" },
  sendBtn: { backgroundColor: "#3b82f6", width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  sendBtnAI: { backgroundColor: "#7e22ce" },
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
