import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import { api } from "../services/api";

// База знань — домашній хаб (лише локальний режим): питання, пошук і перегляд
// ідей та напрацювань за теками й заголовками. Дані йдуть через local-server
// (/api/kb/*), ключ хабу в браузер не потрапляє.

const FOLDER_NAMES = {
  "": "Загальне",
  projects: "Проєкти",
  ideas: "Ідеї",
  dev: "Розробка",
  "house-and-garden": "Дім і сад",
  car: "Авто",
  "claude-rules": "Правила Claude",
  inbox: "Вхідні (ще не розкладено)",
};

const folderName = (f) =>
  FOLDER_NAMES[f] || f.split("/").map((p) => FOLDER_NAMES[p] || p).join(" / ");

const SOURCE_LABEL = {
  mars: "відповів «Марс» на домашньому ПК",
  kb: "ПК вимкнений — відповідь знайдено в базі без моделі",
  timeout: "«Марс» не встиг відповісти",
  error: "помилка «Марса»",
};

// ── Markdown → React-елементи (без сирого HTML: текст записів не виконується) ──

function inline(text, keyBase) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const key = `${keyBase}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={key}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={key} className="bg-gray-700/70 rounded px-1 text-[0.9em]">{t.slice(1, -1)}</code>);
    else {
      const [, label, href] = t.match(/\[([^\]]+)\]\(([^)\s]+)\)/);
      out.push(/^https?:\/\//.test(href)
        ? <a key={key} href={href} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{label}</a>
        : <span key={key} className="text-gray-300">{label}</span>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }) {
  const blocks = [];
  const lines = text.replace(/^---\n[\s\S]*?\n---\n/, "").split("\n"); // без YAML-шапки
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={i} className="bg-gray-950 border border-gray-700 rounded p-3 my-3 overflow-x-auto text-sm">{code.join("\n")}</pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      const size = ["text-2xl", "text-xl", "text-lg", "text-base"][h[1].length - 1];
      blocks.push(<div key={i} className={`${size} font-semibold mt-5 mb-2 text-white`}>{inline(h[2], i)}</div>);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        items.push(<li key={i}>{inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""), i)}</li>);
        i++;
      }
      blocks.push(<ul key={`u${i}`} className="list-disc pl-6 my-2 space-y-1">{items}</ul>);
      continue;
    }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[\s:|-]+\|$/.test(lines[i].trim())) rows.push(lines[i].trim().slice(1, -1).split("|").map((c) => c.trim()));
        i++;
      }
      blocks.push(
        <div key={`t${i}`} className="overflow-x-auto my-3">
          <table className="text-sm border-collapse">
            <tbody>{rows.map((r, ri) => (
              <tr key={ri} className={ri === 0 ? "font-semibold text-gray-200" : ""}>
                {r.map((c, ci) => <td key={ci} className="border border-gray-700 px-2 py-1 align-top">{inline(c, `${i}-${ri}-${ci}`)}</td>)}
              </tr>))}
            </tbody>
          </table>
        </div>);
      continue;
    }
    if (line.startsWith(">")) {
      blocks.push(<blockquote key={i} className="border-l-4 border-gray-600 pl-3 text-gray-400 my-2">{inline(line.replace(/^>\s?/, ""), i)}</blockquote>);
      i++;
      continue;
    }
    if (line.trim() === "" || /^<!--.*-->$/.test(line.trim())) {
      i++;
      continue;
    }
    blocks.push(<p key={i} className="my-2 leading-relaxed">{inline(line, i)}</p>);
    i++;
  }
  return <div className="text-gray-200">{blocks}</div>;
}

// ── Сторінка ──

export default function KnowledgePage() {
  const [entries, setEntries] = useState([]);
  const [listError, setListError] = useState(null);
  const [open, setOpen] = useState({});            // розгорнуті теки
  const [filter, setFilter] = useState("");
  const [found, setFound] = useState(null);         // результати пошуку за змістом
  const [doc, setDoc] = useState(null);
  const [docError, setDocError] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    api.kbList()
      .then((r) => setEntries(r.entries || []))
      .catch((e) => setListError(e.message));
    const p = new URLSearchParams(window.location.search).get("path");
    if (p) openDoc(p);
  }, []);

  const folders = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const groups = {};
    for (const e of entries) {
      if (f && !`${e.title} ${e.path}`.toLowerCase().includes(f)) continue;
      (groups[e.folder] ||= []).push(e);
    }
    return Object.entries(groups).sort(([a], [b]) => folderName(a).localeCompare(folderName(b), "uk"));
  }, [entries, filter]);

  async function openDoc(path) {
    setDocError(null);
    try {
      setDoc(await api.kbGet(path));
      window.history.replaceState(null, "", `/knowledge?path=${encodeURIComponent(path)}`);
    } catch (e) {
      setDoc(null);
      setDocError(e.message);
    }
  }

  async function search(e) {
    e.preventDefault();
    if (!filter.trim()) return setFound(null);
    try {
      setFound((await api.kbSearch(filter.trim())).results || []);
    } catch (err) {
      setFound({ error: err.message });
    }
  }

  async function ask(e) {
    e.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer(await api.kbAsk(question.trim()));
    } catch (err) {
      setAnswer({ answer: err.message, source: "error" });
    } finally {
      setAsking(false);
    }
  }

  const expanded = (f) => open[f] ?? Boolean(filter.trim());

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <AppHeader activePage="knowledge" constrained />

      <div className="flex-1 overflow-hidden">
        <div className="max-w-[1400px] w-full h-full mx-auto flex flex-col">
          {/* Питання до бази */}
          <form onSubmit={ask} className="p-3 sm:p-4 border-b border-gray-700/60 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Запитай базу знань: що я вже знаю чи робив… (напр. «яка модель інвертора»)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button disabled={asking} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded px-4 text-sm font-medium whitespace-nowrap">
              {asking ? "Думаю…" : "Запитати"}
            </button>
          </form>
          {answer && (
            <div className={`mx-3 sm:mx-4 mt-3 p-3 rounded border text-sm ${answer.source === "error" || answer.source === "timeout" ? "border-red-700 bg-red-950/40" : "border-gray-700 bg-gray-800"}`}>
              <div className="whitespace-pre-wrap leading-relaxed">{answer.answer}</div>
              <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-x-3">
                <span>{SOURCE_LABEL[answer.source] || answer.source}</span>
                {answer.path && (
                  <button onClick={() => openDoc(answer.path)} className="text-blue-400 hover:underline">відкрити запис</button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-1 overflow-hidden mt-3">
            {/* Теки й заголовки */}
            <aside className={`${doc ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 lg:w-96 border-r border-gray-700/60 flex-shrink-0`}>
              <form onSubmit={search} className="px-3 pb-2">
                <input
                  value={filter}
                  onChange={(e) => { setFilter(e.target.value); if (!e.target.value) setFound(null); }}
                  placeholder="Фільтр за заголовком · Enter — пошук за змістом"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </form>
              <div className="flex-1 overflow-y-auto px-2 pb-4 text-sm">
                {listError && <p className="text-red-400 px-2">База знань недоступна: {listError}</p>}
                {found && (
                  <div className="mb-3">
                    <div className="px-2 py-1 text-xs uppercase tracking-wide text-gray-500">Знайдено за змістом</div>
                    {found.error ? <p className="text-red-400 px-2">{found.error}</p>
                      : found.length === 0 ? <p className="text-gray-500 px-2">нічого не знайдено</p>
                      : found.map((h) => (
                        <button key={h.path} onClick={() => openDoc(h.path)}
                          className={`block w-full text-left px-2 py-1.5 rounded hover:bg-gray-800 ${doc?.path === h.path ? "bg-gray-800" : ""}`}>
                          <div className="text-gray-100">{h.title || h.path}</div>
                          <div className="text-xs text-gray-500 truncate">{folderName(h.path.includes("/") ? h.path.slice(0, h.path.lastIndexOf("/")) : "")}</div>
                        </button>))}
                  </div>
                )}
                {folders.map(([f, list]) => (
                  <div key={f} className="mb-1">
                    <button onClick={() => setOpen({ ...open, [f]: !expanded(f) })}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-800 text-gray-300 font-medium">
                      <span>{expanded(f) ? "▾" : "▸"} {folderName(f)}</span>
                      <span className="text-xs text-gray-500">{list.length}</span>
                    </button>
                    {expanded(f) && list.map((e) => (
                      <button key={e.path} onClick={() => openDoc(e.path)}
                        className={`block w-full text-left pl-6 pr-2 py-1 rounded hover:bg-gray-800 ${doc?.path === e.path ? "bg-gray-800 text-white" : "text-gray-400"}`}>
                        {e.title || e.path.split("/").pop()}
                      </button>
                    ))}
                  </div>
                ))}
                {!listError && entries.length > 0 && folders.length === 0 && (
                  <p className="text-gray-500 px-2">за заголовком нічого — натисни Enter, щоб шукати за змістом</p>
                )}
              </div>
            </aside>

            {/* Запис */}
            <main className={`${doc || docError ? "flex" : "hidden md:flex"} flex-1 flex-col overflow-y-auto px-4 sm:px-6 pb-8`}>
              {docError && <p className="text-red-400">{docError}</p>}
              {doc ? (
                <>
                  <button onClick={() => { setDoc(null); window.history.replaceState(null, "", "/knowledge"); }}
                    className="md:hidden self-start text-sm text-blue-400 mb-2">← до списку</button>
                  <div className="text-xs text-gray-500 mb-1">{folderName(doc.path.includes("/") ? doc.path.slice(0, doc.path.lastIndexOf("/")) : "")} · {doc.path.split("/").pop()}</div>
                  <h1 className="text-2xl font-bold mb-3">{doc.title}</h1>
                  <Markdown text={doc.text || ""} />
                </>
              ) : !docError && (
                <div className="text-gray-500 m-auto text-center text-sm">
                  {entries.length ? `${entries.length} записів у базі. Обери запис ліворуч або постав питання вгорі.` : "Завантаження…"}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
