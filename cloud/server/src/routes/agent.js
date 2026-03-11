const router = require("express").Router();
const Anthropic = require("@anthropic-ai/sdk");
const auth = require("../middleware/auth");
const Task = require("../models/Task");
const KanbanSettings = require("../models/KanbanSettings");

const SYSTEM_PROMPT = `Ти — AI-асистент для home-hub, домашньої платформи управління.
Ти маєш доступ до канбан-дошки і можеш шукати інформацію в інтернеті.
Відповідай українською мовою. Будь корисним, лаконічним і конкретним.
Результати веб-пошуку підсумовуй коротко і по суті.

## Правила роботи з канбан-дошкою

### Типи задач
Канбан підтримує три типи карток:
- **idea** — Ідея: велика концепція або задум, яка потребує реалізації через конкретні кроки
- **task** — Задача: конкретний крок реалізації (може бути пов'язана з ідеєю)
- **subtask** — Підзадача: деталізований крок всередині задачі (пов'язана з батьківською задачею)

### Коли користувач ділиться ідеєю або концепцією
1. СПОЧАТКУ створюй ONE картку типу **idea** (column: "idea")
   - В description помісти ПОВНИЙ контекст: що це, навіщо, яка проблема вирішується, очікуваний результат
   - Заголовок — коротка суть ідеї
2. ПОТІМ створюй картки типу **task** для кроків реалізації
   - Кожна задача = один конкретний крок
   - В description — деталі реалізації цього кроку
   - Пов'язуй задачі з ідеєю через linkedTaskIds
3. Якщо крок занадто великий — дроби на **subtask** з parentTaskId = id батьківської задачі

### Коли користувач просто просить "додати задачу"
- Якщо це конкретне завдання (не ідея) → створюй type: "task"
- Якщо це задум/концепція → створюй type: "idea" з повним контекстом в description

### Важливо
- Ніколи не губи контекст ідеї — весь задум зберігай в description ідеї
- Кожна задача-крок має бути конкретною і виконуваною
- Для ідей використовуй колонку "idea", для активних задач — "in-progress"
- Якщо питають про задачі — використовуй list_tasks
- Якщо хочуть пов'язати існуючі задачі — використовуй link_tasks`;

const TOOLS = [
  {
    name: "list_tasks",
    description: "Показати список задач канбан-дошки. Можна фільтрувати за колонкою.",
    input_schema: {
      type: "object",
      properties: {
        column: {
          type: "string",
          enum: ["idea", "in-progress", "done", "archive"],
          description: "Фільтр по колонці (необов'язково)",
        },
      },
      required: [],
    },
  },
  {
    name: "create_task",
    description: "Створити нову картку на канбан-дошці. Тип 'idea' — для ідей/концепцій з повним контекстом в description. Тип 'task' — для конкретних кроків реалізації. Тип 'subtask' — для підзадач.",
    input_schema: {
      type: "object",
      properties: {
        title:         { type: "string", description: "Назва" },
        description:   { type: "string", description: "Опис / контекст. Для ідей — повний контекст задуму." },
        type:          { type: "string", enum: ["idea", "task", "subtask"], description: "Тип картки: idea (ідея), task (задача), subtask (підзадача). За замовчуванням: task" },
        column:        { type: "string", enum: ["idea", "in-progress", "done", "archive"], description: "Колонка. За замовчуванням: idea" },
        priority:      { type: "string", enum: ["critical", "high", "medium", "low"], description: "Пріоритет. За замовчуванням: medium" },
        category:      { type: "string", description: "Категорія" },
        parentTaskId:  { type: "string", description: "ID батьківської задачі (для subtask — id задачі; для task — можна вказати id ідеї)" },
        linkedTaskIds: { type: "array", items: { type: "string" }, description: "Список ID задач для пов'язання (наприклад, кроки реалізації ідеї)" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Оновити існуючу картку на канбан-дошці.",
    input_schema: {
      type: "object",
      properties: {
        id:            { type: "string", description: "ID задачі (_id)" },
        title:         { type: "string" },
        description:   { type: "string" },
        type:          { type: "string", enum: ["idea", "task", "subtask"] },
        column:        { type: "string", enum: ["idea", "in-progress", "done", "archive"] },
        priority:      { type: "string", enum: ["critical", "high", "medium", "low"] },
        category:      { type: "string" },
        parentTaskId:  { type: "string", description: "ID батьківської задачі" },
        linkedTaskIds: { type: "array", items: { type: "string" }, description: "Повний список ID пов'язаних задач (перезаписує поточний)" },
      },
      required: ["id"],
    },
  },
  {
    name: "link_tasks",
    description: "Пов'язати дві існуючі задачі між собою (наприклад, задачу-крок з ідеєю).",
    input_schema: {
      type: "object",
      properties: {
        taskId:  { type: "string", description: "ID першої задачі (зазвичай ідея)" },
        linkId:  { type: "string", description: "ID другої задачі (зазвичай крок/задача)" },
      },
      required: ["taskId", "linkId"],
    },
  },
  {
    name: "web_search",
    description: "Пошук інформації в інтернеті. Використовуй для ресерчу, порівняння продуктів, пошуку ціни тощо.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Пошуковий запит" },
      },
      required: ["query"],
    },
  },
];

async function executeTool(name, input) {
  try {
    if (name === "list_tasks") {
      const filter = {};
      if (input.column) filter.column = input.column;
      const tasks = await Task.find(filter).lean();
      if (tasks.length === 0) return "Задач не знайдено.";
      return tasks.map(t => {
        const typeIcon = t.type === "idea" ? "💡" : t.type === "subtask" ? "↳" : "✦";
        return `[${t._id}] ${typeIcon} ${t.title} | тип: ${t.type || "task"} | колонка: ${t.column} | пріоритет: ${t.priority || "medium"}${t.category ? ` | категорія: ${t.category}` : ""}${t.description ? `\n  ${t.description}` : ""}${t.linkedTasks?.length ? `\n  пов'язані: ${t.linkedTasks.join(", ")}` : ""}`;
      }).join("\n\n");
    }

    if (name === "create_task") {
      const count = await Task.countDocuments();
      const taskData = {
        title:       input.title,
        description: input.description || "",
        type:        input.type || "task",
        column:      input.column || "idea",
        priority:    input.priority || "medium",
        category:    input.category || "",
        order:       count,
      };
      if (input.parentTaskId) taskData.parentTask = input.parentTaskId;
      if (input.linkedTaskIds?.length) taskData.linkedTasks = input.linkedTaskIds;

      const task = await Task.create(taskData);
      const typeLabel = task.type === "idea" ? "💡 Ідею" : task.type === "subtask" ? "Підзадачу" : "Задачу";
      return `${typeLabel} створено: [${task._id}] "${task.title}" в колонці "${task.column}".`;
    }

    if (name === "update_task") {
      const { id, parentTaskId, linkedTaskIds, ...rest } = input;
      const updates = { ...rest };
      if (parentTaskId !== undefined) updates.parentTask = parentTaskId || null;
      if (linkedTaskIds !== undefined) updates.linkedTasks = linkedTaskIds;
      const task = await Task.findByIdAndUpdate(id, updates, { new: true });
      if (!task) return `Задачу з ID ${id} не знайдено.`;
      return `Задачу оновлено: "${task.title}" — тип: ${task.type}, колонка: ${task.column}.`;
    }

    if (name === "link_tasks") {
      const [t1, t2] = await Promise.all([
        Task.findById(input.taskId),
        Task.findById(input.linkId),
      ]);
      if (!t1) return `Задачу ${input.taskId} не знайдено.`;
      if (!t2) return `Задачу ${input.linkId} не знайдено.`;

      const addLink = async (task, linkId) => {
        if (!task.linkedTasks.map(String).includes(String(linkId))) {
          task.linkedTasks.push(linkId);
          await task.save();
        }
      };
      await addLink(t1, t2._id);
      await addLink(t2, t1._id);
      return `Задачі "${t1.title}" і "${t2.title}" пов'язано.`;
    }

    if (name === "web_search") {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(input.query)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(url, { headers: { "User-Agent": "home-hub/1.0" } });
      if (!res.ok) return "Пошук недоступний.";
      const data = await res.json();

      const parts = [];
      if (data.Answer) parts.push(`Відповідь: ${data.Answer}`);
      if (data.AbstractText) parts.push(`Опис: ${data.AbstractText}`);
      if (data.RelatedTopics?.length) {
        const topics = data.RelatedTopics
          .filter(t => t.Text)
          .slice(0, 5)
          .map(t => `• ${t.Text}${t.FirstURL ? ` (${t.FirstURL})` : ""}`);
        if (topics.length) parts.push("Пов'язані теми:\n" + topics.join("\n"));
      }

      return parts.length > 0
        ? parts.join("\n\n")
        : `Результатів по запиту "${input.query}" не знайдено. Спробуй точніший запит.`;
    }

    return `Невідомий інструмент: ${name}`;
  } catch (err) {
    return `Помилка: ${err.message}`;
  }
}

// POST /api/agent/chat
router.post("/chat", auth, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY не налаштовано" });
  }

  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message required" });

  try {
    const client = new Anthropic.default({ apiKey });

    // Будуємо histoty для API (не більше 20 повідомлень)
    const apiMessages = history
      .slice(-20)
      .filter(m => m.text && m.senderId)
      .map(m => ({
        role: m.senderId === "ai" ? "assistant" : "user",
        content: m.text,
      }));

    apiMessages.push({ role: "user", content: message.trim() });

    let response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: apiMessages,
    });

    // Agentic loop — виконуємо інструменти поки є tool_use
    let iterations = 0;
    while (response.stop_reason === "tool_use" && iterations < 5) {
      iterations++;
      const toolUseBlocks = response.content.filter(b => b.type === "tool_use");

      apiMessages.push({ role: "assistant", content: response.content });

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => ({
          type: "tool_result",
          tool_use_id: block.id,
          content: await executeTool(block.name, block.input),
        }))
      );

      apiMessages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: apiMessages,
      });
    }

    const textBlock = response.content.find(b => b.type === "text");
    const responseText = textBlock?.text || "Немає відповіді.";

    res.json({ response: responseText });
  } catch (err) {
    console.error("[Agent]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
