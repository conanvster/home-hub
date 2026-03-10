import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import AppHeader from "../components/AppHeader";

function UserList({ users, selected, onSelect, unread }) {
  return (
    <div className="flex flex-col border-r border-gray-700 w-64 flex-shrink-0">
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
            selected === null ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"
          }`}
        >
          💬 Загальний чат
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        <p className="text-gray-500 text-xs px-2 py-1">Особисті повідомлення</p>
        {users.map((u) => {
          const unreadCount = unread[u._id] || 0;
          return (
            <button
              key={u._id}
              onClick={() => onSelect(u)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition ${
                selected?._id === u._id ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <span className="truncate">👤 {u.email.split("@")[0]}</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MessageBubble({ msg, myId }) {
  const isOwn = msg.senderId === myId;
  const time = new Date(msg.createdAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  const name = msg.senderEmail?.split("@")[0];
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isOwn ? "bg-blue-600" : "bg-gray-700"}`}>
        {!isOwn && <p className="text-blue-400 text-xs font-semibold mb-1">{name}</p>}
        <p className="text-white text-sm whitespace-pre-wrap">{msg.text}</p>
        <p className="text-white/40 text-xs text-right mt-1">{time}</p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const myId = user?._id || JSON.parse(localStorage.getItem("auth") || "{}")?.state?.user?._id;

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); // null = загальний чат
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState({});
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const intervalRef = useRef(null);

  // Завантажити список юзерів
  useEffect(() => {
    api.getChatUsers().then(setUsers).catch(console.error);
  }, []);

  // Оновлення пошуку юзерів
  useEffect(() => {
    api.getChatUsers(search).then(setUsers).catch(console.error);
  }, [search]);

  // Непрочитані
  const loadUnread = useCallback(() => {
    api.getChatUnread()
      .then((data) => {
        const map = {};
        data.forEach((d) => { map[d._id] = d.count; });
        setUnread(map);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadUnread();
    const t = setInterval(loadUnread, 10000);
    return () => clearInterval(t);
  }, [loadUnread]);

  // Завантажити повідомлення при зміні діалогу
  const loadMessages = useCallback(() => {
    api.getChatMessages(selectedUser?._id)
      .then((data) => {
        setMessages(data);
        if (selectedUser) {
          setUnread((prev) => ({ ...prev, [selectedUser._id]: 0 }));
        }
      })
      .catch(console.error);
  }, [selectedUser]);

  useEffect(() => {
    setMessages([]);
    loadMessages();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(loadMessages, 3000);
    return () => clearInterval(intervalRef.current);
  }, [loadMessages]);

  // Скрол вниз при нових повідомленнях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const msg = text.trim();
    if (!msg || sending) return;
    setText("");
    setSending(true);
    try {
      const newMsg = await api.sendChatMessage(msg, selectedUser?._id);
      setMessages((prev) => [...prev, newMsg]);
    } catch (err) {
      setText(msg);
      console.error("Chat send:", err.message);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const title = selectedUser ? `💬 ${selectedUser.email.split("@")[0]}` : "💬 Загальний чат";

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <AppHeader activePage="chat" constrained />

      <div className="flex flex-1 overflow-hidden">
      <div className="max-w-[1024px] min-w-[800px] mx-auto w-full flex overflow-hidden">
        {/* Sidebar */}
        <div className="flex flex-col border-r border-gray-700 w-64 flex-shrink-0">
          <div className="p-3 border-b border-gray-700 flex flex-col gap-2">
            <button
              onClick={() => setSelectedUser(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                selectedUser === null ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              💬 Загальний чат
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук користувача..."
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            <p className="text-gray-500 text-xs px-2 py-1">Особисті повідомлення</p>
            {users.map((u) => {
              const unreadCount = unread[u._id] || 0;
              return (
                <button
                  key={u._id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition ${
                    selectedUser?._id === u._id ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  <span className="truncate">👤 {u.email.split("@")[0]}</span>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
            {users.length === 0 && (
              <p className="text-gray-500 text-xs px-2">Користувачів не знайдено</p>
            )}
          </div>
        </div>

        {/* Чат */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 font-semibold text-sm">{title}</div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <p className="text-gray-500 text-sm text-center mt-10">Немає повідомлень. Напишіть перше!</p>
            )}
            {messages.map((m) => (
              <MessageBubble key={m._id} msg={m} myId={myId} />
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-gray-700 flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Повідомлення... (Enter — надіслати, Shift+Enter — новий рядок)"
              rows={1}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 resize-none"
              style={{ minHeight: 40, maxHeight: 120 }}
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 rounded-xl text-sm font-semibold transition"
            >
              {sending ? "..." : "▶"}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
