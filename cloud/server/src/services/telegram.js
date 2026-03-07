const TelegramBot = require("node-telegram-bot-api");
const User = require("../models/User");
const Tracker = require("../models/Tracker");
const Log = require("../models/Log");
const ZoneState = require("../models/ZoneState");
const Zone = require("../models/Zone");

let bot = null;

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
  console.log("[Telegram] Bot initialized");

  // /start, /help
  bot.onText(/\/start|\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
      "🏠 *Home Hub Bot*\n\n" +
      "Команди:\n" +
      "/register `email` — прив'язати Telegram до акаунту\n" +
      "/where — остання позиція трекера\n" +
      "/help — ця довідка",
      { parse_mode: "Markdown" }
    );
  });

  // /register email
  bot.onText(/\/register (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const email = match[1].trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user) {
      return bot.sendMessage(chatId, "❌ Користувача не знайдено.");
    }
    user.telegramId = String(chatId);
    await user.save();
    bot.sendMessage(chatId, `✅ Акаунт *${email}* прив'язано до Telegram.`, { parse_mode: "Markdown" });
  });

  // /where — вибір трекера
  bot.onText(/\/where/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await User.findOne({ telegramId: String(chatId) });
    if (!user) {
      return bot.sendMessage(chatId, "❌ Спочатку зареєструйтесь: /register email");
    }
    const trackers = await Tracker.find({ userId: user._id, active: true });
    if (!trackers.length) {
      return bot.sendMessage(chatId, "Трекерів не знайдено.");
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
    const tracker = await Tracker.findById(trackerId);
    if (!tracker) return bot.sendMessage(chatId, "Трекер не знайдено.");
    const log = await Log.findOne({ imei: tracker.imei }).sort({ deviceTime: -1 });
    if (!log) return bot.sendMessage(chatId, "Немає даних для цього трекера.");
    const link = mapsLink(log.latitude, log.longitude);

    // Перевіряємо чи трекер у зоні
    const activeZoneState = await ZoneState.findOne({ imei: tracker.imei, isInside: true });
    let locationLine;
    if (activeZoneState) {
      const zone = await Zone.findById(activeZoneState.zoneId);
      locationLine = `Зона: 🟢 *${zone ? zone.name : "невідома"}*`;
    } else {
      const address = await getAddress(log.latitude, log.longitude);
      locationLine = address ? `Адреса: ${address}` : "";
    }

    bot.sendMessage(chatId,
      `📍 *${tracker.name}*\n` +
      `Швидкість: ${log.speed.toFixed(0)} км/г\n` +
      `Час: ${new Date(log.deviceTime).toLocaleString("uk")}\n` +
      (locationLine ? `${locationLine}\n` : "") +
      `\n[Відкрити на Google Maps](${link})`,
      { parse_mode: "Markdown" }
    );
  });

  bot.on("polling_error", (err) => console.error("[Telegram] polling error:", err.message));
}

function sendMsg(telegramId, text) {
  if (!bot || !telegramId) return;
  bot.sendMessage(telegramId, text, { parse_mode: "Markdown" }).catch((err) => {
    console.error("[Telegram] sendMsg error:", err.message);
  });
}

module.exports = { init, sendMsg, mapsLink };
