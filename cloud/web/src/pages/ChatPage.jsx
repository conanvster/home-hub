import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import AppHeader from "../components/AppHeader";
import { IS_LOCAL } from "../config";

// Спеціальний "користувач" для AI агента (тільки локально)
const AI_USER = { _id: "ai", email: "ai@agent.local" };

function MessageBubble({ msg, myId }) {
  const isOwn = msg.senderId === myId;
  const isAI  = msg.senderId === "ai";
  const time = new Date(msg.createdAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  const name = isAI ? "🤖 AI" : msg.senderEmail?.split("@")[0];
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isOwn ? "bg-blue-600" : isAI ? "bg-purple-900 border border-purple-700" : "bg-gray-700"}`}>
        {!isOwn && <p className={`text-xs font-semibold mb-1 ${isAI ? "text-purple-300" : "text-blue-400"}`}>{name}</p>}
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
  const [showSidebar, setShowSidebar] = useState(true); // мобільний стан
  const bottomRef = useRef(null);
  const intervalRef = useRef(null);
  const textareaRef = useRef(null);

  // Автозмінення висоти textarea
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const isAISelected = selectedUser?._id === "ai";

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
    if (isAISelected) return; // AI — тільки локальний стан
    api.getChatMessages(selectedUser?._id)
      .then((data) => {
        setMessages(data);
        if (selectedUser) {
          setUnread((prev) => ({ ...prev, [selectedUser._id]: 0 }));
        }
      })
      .catch(console.error);
  }, [selectedUser, isAISelected]);

  useEffect(() => {
    setMessages([]);
    if (isAISelected) return;
    loadMessages();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(loadMessages, 3000);
    return () => clearInterval(intervalRef.current);
  }, [loadMessages, isAISelected]);

  // Скрол вниз при нових повідомленнях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const msg = text.trim();
    if (!msg || sending) return;
    setText("");
    setSending(true);

    if (isAISelected) {
      // AI режим — додаємо повідомлення локально і звертаємось до агента
      const userMsg = {
        _id: `user-${Date.now()}`,
        senderId: myId,
        senderEmail: user?.email,
        text: msg,
        createdAt: new Date().toISOString(),
      };
      const currentMessages = [...messages, userMsg];
      setMessages(currentMessages);
      try {
        const { response } = await api.agentChat(msg, currentMessages);
        setMessages(prev => [...prev, {
          _id: `ai-${Date.now()}`,
          senderId: "ai",
          senderEmail: "ai@agent.local",
          text: response,
          createdAt: new Date().toISOString(),
        }]);
      } catch (err) {
        setMessages(prev => [...prev, {
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

  function handleSelectUser(u) {
    setSelectedUser(u);
    setMessages([]);
    setShowSidebar(false); // на мобільному переходимо в чат
  }

  const title = isAISelected
    ? "🤖 AI Агент"
    : selectedUser
      ? `💬 ${selectedUser.email.split("@")[0]}`
      : "💬 Загальний чат";

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <AppHeader activePage="chat" constrained />

      <div className="flex flex-1 overflow-hidden">
      <div className="max-w-[1024px] w-full mx-auto flex overflow-hidden">

        {/* Sidebar — на мобільному: повний екран або прихований */}
        <div className={`flex-col border-r border-gray-700/60 flex-shrink-0
          ${showSidebar ? "flex w-full" : "hidden"}
          md:flex md:w-64`}>
          <div className="p-3 border-b border-gray-700/60 flex flex-col gap-2">
            <button
              onClick={() => handleSelectUser(null)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
                selectedUser === null ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700/60"
              }`}
            >
              💬 Загальний чат
            </button>

            {/* AI агент — тільки локально */}
            {IS_LOCAL && (
              <button
                onClick={() => handleSelectUser(AI_USER)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
                  isAISelected ? "bg-purple-700 text-white" : "text-gray-300 hover:bg-gray-700/60"
                }`}
              >
                🤖 AI Агент
              </button>
            )}

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук користувача..."
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition"
            />
          </div>
          <div className="flex-1 overflow-y-auto chat-scroll p-2 flex flex-col gap-1">
            <p className="text-gray-500 text-xs px-2 py-1">Особисті повідомлення</p>
            {users.map((u) => {
              const unreadCount = unread[u._id] || 0;
              return (
                <button
                  key={u._id}
                  onClick={() => handleSelectUser(u)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between transition ${
                    selectedUser?._id === u._id ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700/60"
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

        {/* Чат — на мобільному: повний екран або прихований */}
        <div className={`flex-col flex-1 overflow-hidden
          ${!showSidebar ? "flex" : "hidden"}
          md:flex`}>

          {/* Хедер чату — кнопка "назад" лише на мобільному */}
          <div className="px-4 py-3 border-b border-gray-700/60 font-semibold text-sm flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(true)}
              className="md:hidden text-gray-400 hover:text-white mr-1 text-base leading-none"
            >
              ←
            </button>
            {title}
            {isAISelected && (
              <span className="text-purple-400 text-xs font-normal hidden sm:inline">· може шукати в інтернеті та керувати канбаном</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto chat-scroll p-4 flex flex-col gap-3">
            {messages.length === 0 && !isAISelected && (
              <p className="text-gray-500 text-sm text-center mt-10">Немає повідомлень. Напишіть перше!</p>
            )}
            {messages.length === 0 && isAISelected && (
              <p className="text-gray-500 text-sm text-center mt-10">
                Привіт! Я можу:<br/>
                📋 Переглядати та створювати задачі на канбані<br/>
                🔍 Шукати інформацію в інтернеті<br/>
                💡 Допомагати з рішеннями для дому
              </p>
            )}
            {messages.map((m) => (
              <MessageBubble key={m._id} msg={m} myId={myId} />
            ))}
            {sending && isAISelected && (
              <div className="flex justify-start">
                <div className="bg-purple-900 border border-purple-700 rounded-2xl px-4 py-2">
                  <p className="text-purple-300 text-xs font-semibold mb-1">🤖 AI</p>
                  <p className="text-white text-sm">Думаю...</p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-gray-700/60 flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={isAISelected ? "Запитай AI агента..." : "Повідомлення..."}
              rows={1}
              className={`flex-1 bg-gray-800 border rounded-2xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none resize-none overflow-hidden transition ${
                isAISelected ? "border-purple-700/70 focus:border-purple-500" : "border-gray-700 focus:border-blue-500"
              }`}
              style={{ minHeight: 42, maxHeight: 160 }}
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className={`disabled:opacity-40 text-white w-10 h-10 flex-shrink-0 rounded-2xl text-sm font-semibold flex items-center justify-center transition ${
                isAISelected ? "bg-purple-700 hover:bg-purple-600" : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {sending ? "·" : "▶"}
            </button>
          </div>
        </div>

      </div>
      </div>
    </div>
  );
}
