import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/useAuthStore";
import { api } from "../../src/services/api";

function MessageBubble({ msg, isOwn }) {
  const time = new Date(msg.createdAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  const name = msg.email.split("@")[0];
  return (
    <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
      {!isOwn && <Text style={s.bubbleName}>{name}</Text>}
      <Text style={s.bubbleText}>{msg.text}</Text>
      <Text style={s.bubbleTime}>{time}</Text>
    </View>
  );
}

export default function ChatScreen() {
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getChatMessages();
      setMessages(data);
    } catch (err) {
      console.error("Chat load error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function send() {
    const msg = text.trim();
    if (!msg || sending) return;
    setText("");
    setSending(true);
    try {
      const newMsg = await api.sendChatMessage(msg);
      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error("Chat send error:", err.message);
      setText(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>💬 Чат</Text>
        {loading && <ActivityIndicator size="small" color="#3b82f6" />}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m._id}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <MessageBubble msg={item} isOwn={item.userId === user?._id || item.email === user?.email} />
          )}
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
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.sendIcon}>▶</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#374151" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
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
});
