const TelegramBot = require("node-telegram-bot-api");
const User = require("../models/User");
const Tracker = require("../models/Tracker");
const Log = require("../models/Log");
const ZoneState = require("../models/ZoneState");
const Zone = require("../models/Zone");
const TelegramMessage = require("../models/TelegramMessage");

let bot = null;
let processingQueue = false;

function mapsLink(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

async function getAddress(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=uk`;
    const res = await fetch(url, { headers: { "User-Agent": "HomeHubBot/1.0" } });
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}

// Зберегти вхідне повідомлення
async function saveIncoming(chatId, text, metadata = {}) {
  try {
    await TelegramMessage.create({
      direction: "in",
      telegramId: String(chatId),
      text,
      metadata,
      status: "received",
      processedAt: new Date(),
    });
  } catch (err) {
    console.error("[Telegram] saveIncoming error:", err.message);
  }
}

// Поставити вихідне повідомлення в чергу
async function queueMsg(telegramId, text, metadata = {}) {
  if (!telegramId) return;
  try {
    await TelegramMessage.create({
      direction: "out",
      telegramId: String(telegramId),
      text,
      metadata,
      status: "pending",
    });
  } catch (err) {
    console.error("[Telegram] queueMsg error:", err.message);
  }
}

// Обробник черги — запускається кожні 5 секунд
async function processQueue() {
  if (!bot || processingQueue) return;
  processingQueue = true;
  try {
    const pending = await TelegramMessage.find({
      direction: "out",
      status: "pending",
    })
      .sort({ createdAt: 1 })
      .limit(10);

    for (const msg of pending) {
      try {
        await bot.sendMessage(msg.telegramId, msg.text, { parse_mode: "Markdown" });
        msg.status = "sent";
        msg.processedAt = new Date();
        msg.error = null;
      } catch (err) {
        msg.status = "failed";
        msg.error = err.message;
        msg.processedAt = new Date();
        console.error(`[Telegram] Failed to send to ${msg.telegramId}:`, err.message);
      }
      await msg.save();
    }
  } finally {
    processingQueue = false;
  }
}

function init() {
  const token = process.env.TELEGRAM_BOT;
  if (!token) {
    console.log("[Telegram] TELEGRAM_BOT not set — bot disabled");
    return;
  }

  bot = new TelegramBot(token, { polling: false });

  let restarting = false;

  function startPolling() {
    bot.startPolling({ restart: false });
    console.log("[Telegram] Bot polling started");
  }

  bot.on("polling_error", (err) => {
    if (err.code === "ETELEGRAM" && err.message.includes("409") && !restarting) {
      restarting = true;
      bot.stopPolling().finally(() => {
        console.log("[Telegram] 409 detected — retry in 30s");
        setTimeout(() => {
          restarting = false;
          startPolling();
        }, 30000);
      });
    }
  });

  // Стартуємо через 5с після ініціалізації
  setTimeout(startPolling, 5000);

  // Запускаємо обробник черги кожні 5 секунд
  setInterval(processQueue, 5000);

  console.log("[Telegram] Bot initialized");

  // /start, /help
  bot.onText(/\/start|\/help/, async (msg) => {
    await saveIncoming(msg.chat.id, msg.text, { command: "help" });
    await queueMsg(msg.chat.id,
      "🏠 *Home Hub Bot*\n\n" +
      "Команди прив'язки:\n" +
      "/register `email` — надіслати код на email\n" +
      "/confirm `код` — підтвердити код з email\n" +
      "/link `код` — прив'язати кодом з сайту\n" +
      "/unlink — відключити Telegram від акаунту\n\n" +
      "Інше:\n" +
      "/where — остання позиція трекера\n" +
      "/version — версія сервера\n" +
      "/help — ця довідка",
      { command: "help" }
    );
  });

  // /register email — Варіант B: надіслати 6-значний код на email
  bot.onText(/\/register (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const email = match[1].trim().toLowerCase();
    await saveIncoming(chatId, msg.text, { command: "register", email });

    const user = await User.findOne({ email });
    if (!user) {
      return queueMsg(chatId, "❌ Користувача не знайдено.", { command: "register" });
    }
    const { sendTelegramCode } = require("./email");
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.telegramLinkCode = code;
    user.telegramLinkCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
    user.telegramLinkChatId = String(chatId);
    await user.save();
    try {
      await sendTelegramCode(email, code);
      await queueMsg(chatId,
        `📧 Код надіслано на *${email}*\\.\nВведіть: /confirm КОД`,
        { command: "register", email }
      );
    } catch {
      await queueMsg(chatId, "❌ Не вдалося надіслати email. Спробуйте пізніше.", { command: "register" });
    }
  });

  // /confirm CODE
  bot.onText(/\/confirm (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const code = match[1].trim();
    await saveIncoming(chatId, msg.text, { command: "confirm" });

    const user = await User.findOne({
      telegramLinkCode: code,
      telegramLinkChatId: String(chatId),
      telegramLinkCodeExpires: { $gt: new Date() },
    });
    if (!user) {
      return queueMsg(chatId, "❌ Невірний або прострочений код.", { command: "confirm" });
    }
    user.telegramId = String(chatId);
    user.telegramLinkCode = null;
    user.telegramLinkCodeExpires = null;
    user.telegramLinkChatId = null;
    await user.save();
    await queueMsg(chatId, `✅ Telegram прив'язано до акаунту *${user.email}*`, { command: "confirm" });
  });

  // /link CODE — Варіант C: прив'язати кодом з сайту
  bot.onText(/\/link (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const code = match[1].trim();
    await saveIncoming(chatId, msg.text, { command: "link" });

    const user = await User.findOne({
      telegramLinkCode: code,
      telegramLinkCodeExpires: { $gt: new Date() },
    });
    if (!user) {
      return queueMsg(chatId, "❌ Невірний або прострочений код.", { command: "link" });
    }
    user.telegramId = String(chatId);
    user.telegramLinkCode = null;
    user.telegramLinkCodeExpires = null;
    user.telegramLinkChatId = null;
    await user.save();
    await queueMsg(chatId, `✅ Telegram прив'язано до акаунту *${user.email}*`, { command: "link" });
  });

  // /unlink
  bot.onText(/\/unlink/, async (msg) => {
    const chatId = msg.chat.id;
    await saveIncoming(chatId, msg.text, { command: "unlink" });

    const user = await User.findOne({ telegramId: String(chatId) });
    if (!user) {
      return queueMsg(chatId, "❌ Telegram не прив'язано до жодного акаунту.", { command: "unlink" });
    }
    user.telegramId = null;
    await user.save();
    await queueMsg(chatId, "✅ Telegram відключено від акаунту.", { command: "unlink" });
  });

  // /where — вибір трекера
  bot.onText(/\/where/, async (msg) => {
    const chatId = msg.chat.id;
    await saveIncoming(chatId, msg.text, { command: "where" });

    const user = await User.findOne({ telegramId: String(chatId) });
    if (!user) {
      return queueMsg(chatId, "❌ Спочатку зареєструйтесь: /register email", { command: "where" });
    }
    const trackers = await Tracker.find({ userId: user._id, active: true });
    if (!trackers.length) {
      return queueMsg(chatId, "Трекерів не знайдено.", { command: "where" });
    }
    bot.sendMessage(chatId, "Оберіть трекер:", {
      reply_markup: {
        inline_keyboard: trackers.map((t) => ([{
          text: t.name,
          callback_data: `where_${t._id}`,
        }])),
      },
    });
  });

  // callback: where_<trackerId>
  bot.on("callback_query", async (query) => {
    const chatId = query.from.id;
    if (!query.data.startsWith("where_")) return;
    const trackerId = query.data.replace("where_", "");

    await saveIncoming(chatId, `/where callback:${trackerId}`, { command: "where_callback", trackerId });

    const tracker = await Tracker.findById(trackerId);
    if (!tracker) return queueMsg(chatId, "Трекер не знайдено.", { command: "where_callback" });

    const log = await Log.findOne({ imei: tracker.imei }).sort({ deviceTime: -1 });
    if (!log) return queueMsg(chatId, "Немає даних для цього трекера.", { command: "where_callback" });

    const link = mapsLink(log.latitude, log.longitude);

    const activeZoneState = await ZoneState.findOne({ imei: tracker.imei, isInside: true });
    let locationLine;
    if (activeZoneState) {
      const zone = await Zone.findById(activeZoneState.zoneId);
      locationLine = `Зона: 🟢 *${zone ? zone.name : "невідома"}*`;
    } else {
      const address = await getAddress(log.latitude, log.longitude);
      locationLine = address ? `Адреса: ${address}` : "";
    }

    await queueMsg(chatId,
      `📍 *${tracker.name}*\n` +
      `Швидкість: ${log.speed.toFixed(0)} км/г\n` +
      `Час: ${new Date(log.deviceTime).toLocaleString("uk")}\n` +
      (locationLine ? `${locationLine}\n` : "") +
      `\n[Відкрити на Google Maps](${link})`,
      { command: "where_callback", imei: tracker.imei }
    );
  });

  // /version
  bot.onText(/\/version/, async (msg) => {
    const chatId = msg.chat.id;
    await saveIncoming(chatId, msg.text, { command: "version" });
    const version = `cloud@${process.env.GIT_COMMIT || "unknown"}`;
    await queueMsg(chatId, `🏠 Home Hub Server\nВерсія: \`${version}\``, { command: "version" });
  });

  bot.on("polling_error", (err) => console.error("[Telegram] polling error:", err.message));
}

module.exports = { init, queueMsg, mapsLink };
