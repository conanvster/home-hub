import { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Clipboard, Platform,
} from "react-native";

const MAX_LOGS = 100;
const _logs = []; // глобальний буфер
let _notify = null; // callback для оновлення UI

function addLog(level, args) {
  const msg = args
    .map((a) => {
      if (a instanceof Error) return `${a.message}\n${a.stack || ""}`;
      if (typeof a === "object") {
        try { return JSON.stringify(a, null, 2); } catch { return String(a); }
      }
      return String(a);
    })
    .join(" ");

  const entry = {
    id: Date.now() + Math.random(),
    level,
    msg,
    time: new Date().toLocaleTimeString("uk-UA"),
  };
  _logs.unshift(entry);
  if (_logs.length > MAX_LOGS) _logs.pop();
  _notify?.([..._logs]);
}

// Патчимо console один раз
const _origLog   = console.log;
const _origWarn  = console.warn;
const _origError = console.error;

console.log   = (...a) => { _origLog(...a);   addLog("log",   a); };
console.warn  = (...a) => { _origWarn(...a);  addLog("warn",  a); };
console.error = (...a) => { _origError(...a); addLog("error", a); };

const LEVEL_COLOR = {
  log:   "#9ca3af",
  warn:  "#facc15",
  error: "#f87171",
};

export default function DebugPanel() {
  const [logs, setLogs] = useState([..._logs]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    _notify = setLogs;
    return () => { _notify = null; };
  }, []);

  function copyLogs() {
    const text = logs
      .map((l) => `[${l.time}][${l.level.toUpperCase()}] ${l.msg}`)
      .join("\n");
    Clipboard.setString(text);
    console.log("📋 Логи скопійовано");
  }

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount  = logs.filter((l) => l.level === "warn").length;

  return (
    <View style={s.container}>
      {/* Toggle button */}
      <TouchableOpacity style={s.toggle} onPress={() => setOpen((v) => !v)}>
        <Text style={s.toggleText}>
          🐛 DEBUG {errorCount > 0 && <Text style={{ color: "#f87171" }}> {errorCount} err</Text>}
          {warnCount > 0 && <Text style={{ color: "#facc15" }}> {warnCount} warn</Text>}
          {logs.length > 0 && <Text style={{ color: "#6b7280" }}> ({logs.length})</Text>}
          {"  "}{open ? "▼" : "▲"}
        </Text>
        {open && (
          <TouchableOpacity onPress={copyLogs} style={s.copyBtn}>
            <Text style={s.copyText}>📋 Copy</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Log list */}
      {open && (
        <ScrollView style={s.logList} contentContainerStyle={{ padding: 8, gap: 4 }}>
          {logs.length === 0 && (
            <Text style={{ color: "#6b7280", fontSize: 11 }}>Немає логів</Text>
          )}
          {logs.map((l) => (
            <View key={l.id} style={s.logEntry}>
              <Text style={[s.logLevel, { color: LEVEL_COLOR[l.level] }]}>
                [{l.time}][{l.level.toUpperCase()}]
              </Text>
              <Text style={s.logMsg} selectable>{l.msg}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: "#0f172a",
    borderTopWidth: 1,
    borderTopColor: "#374151",
    maxHeight: 300,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleText: { color: "#9ca3af", fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  copyBtn: { backgroundColor: "#1f2937", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  copyText: { color: "#3b82f6", fontSize: 11 },
  logList: { maxHeight: 240 },
  logEntry: { marginBottom: 6 },
  logLevel: { fontSize: 10, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  logMsg: { fontSize: 11, color: "#e5e7eb", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", flexWrap: "wrap" },
});
