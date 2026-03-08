const CLOUD_URL = process.env.CLOUD_URL || "https://mytracking.com.ua";
const SYNC_SECRET = process.env.SYNC_SECRET;

// Відправити Telegram повідомлення через чергу хмарного бота
async function sendTelegramMessage(telegramId, text, metadata = {}) {
  try {
    const res = await fetch(`${CLOUD_URL}/api/telegram/queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": SYNC_SECRET,
      },
      body: JSON.stringify({ telegramId, text, metadata }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("[Notify] Failed to queue Telegram message:", err.message);
  }
}

module.exports = { sendTelegramMessage };
