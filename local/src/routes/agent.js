const router = require("express").Router();
const Anthropic = require("@anthropic-ai/sdk");
const Task = require("../models/Task");
const KanbanSettings = require("../models/KanbanSettings");

const SYSTEM_PROMPT = `Ти — ІА-асистент для home-hub, домашньої платформи управління.
Ти маєш доступ до канбан-дошки і можеш шукати інформацію в інтернеті.
Відповідай українською мовою. Будь корисним, лаконічним і конкретним.
Якщо тебе просять додати задачу — використовуй інструмент create_task.
Якщо питають про задачі — використовуй list_tasks.
Результати веб-пошуку підсумовуй коротко і по суті.`;

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
    description: "Створити нову задачу на канбан-дошці.",
    input_schema: {
      type: "object",
      properties: {
        title:       { type: "string", description: "Назва задачі" },
        description: { type: "string", description: "Опис задачі" },
        column:      { type: "string", enum: ["idea", "in-progress", "done", "archive"], description: "Колонка (за замовчуванням: idea)" },
        priority:    { type: "string", enum: ["critical", "high", "medium", "low"], description: "Пріоритет (за замовчуванням: medium)" },
        category:    { type: "string", description: "Категорія" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Оновити існуючу задачу на канбан-дошці.",
    input_schema: {
      type: "object",
      properties: {
        id:          { type: "string", description: "ID задачі (_id)" },
        title:       { type: "string" },
        description: { type: "string" },
        column:      { type: "string", enum: ["idea", "in-progress", "done", "archive"] },
        priority:    { type: "string", enum: ["critical", "high", "medium", "low"] },
        category:    { type: "string" },
      },
      required: ["id"],
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
      return tasks.map(t =>
        `[${t._id}] ${t.title} | колонка: ${t.column} | пріоритет: ${t.priority || "medium"}${t.category ? ` | категорія: ${t.category}` : ""}${t.description ? `\n  ${t.description}` : ""}`
      ).join("\n\n");
    }

    if (name === "create_task") {
      const count = await Task.countDocuments();
      const task = await Task.create({
        title:       input.title,
        description: input.description || "",
        column:      input.column || "idea",
        priority:    input.priority || "medium",
        category:    input.category || "",
        order:       count,
      });
      return `Задачу створено: [${task._id}] "${task.title}" в колонці "${task.column}".`;
    }

    if (name === "update_task") {
      const { id, ...updates } = input;
      const task = await Task.findByIdAndUpdate(id, updates, { new: true });
      if (!task) return `Задачу з ID ${id} не знайдено.`;
      return `Задачу оновлено: "${task.title}" — колонка: ${task.column}, пріоритет: ${task.priority}.`;
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
router.post("/chat", async (req, res) => {
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
