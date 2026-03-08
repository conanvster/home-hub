const Log = require("../models/Log");
const Tracker = require("../models/Tracker");
const Zone = require("../models/Zone");
const TelegramMessage = require("../models/TelegramMessage");
const SyncState = require("../models/SyncState");

const CLOUD_URL = process.env.CLOUD_URL || "https://mytracking.com.ua";
const SYNC_SECRET = process.env.SYNC_SECRET;

async function syncFromCloud() {
  const state = await SyncState.get();
  const since = state.lastSync ? state.lastSync.toISOString() : null;
  const sinceTelegram = state.lastTelegramSync ? state.lastTelegramSync.toISOString() : null;

  console.log(`[${new Date().toISOString()}] Syncing from cloud...`);

  const headers = { "x-sync-secret": SYNC_SECRET };

  // Паралельно: трекери, зони, логи і telegram
  let logsRes, trackersRes, zonesRes, telegramRes;
  try {
    const logsUrl = `${CLOUD_URL}/api/sync${since ? `?since=${since}` : ""}`;
    const telegramUrl = `${CLOUD_URL}/api/sync/telegram${sinceTelegram ? `?since=${sinceTelegram}` : ""}`;
    [logsRes, trackersRes, zonesRes, telegramRes] = await Promise.all([
      fetch(logsUrl, { headers }),
      fetch(`${CLOUD_URL}/api/sync/trackers`, { headers }),
      fetch(`${CLOUD_URL}/api/sync/zones`, { headers }),
      fetch(telegramUrl, { headers }),
    ]);
  } catch (err) {
    const errMsg = `Network error: ${err.message}`;
    console.error(`[Sync] ${errMsg}`);
    await SyncState.findOneAndUpdate({}, { lastError: errMsg, lastErrorAt: new Date() });
    throw new Error(errMsg);
  }

  if (!logsRes.ok) {
    const errMsg = `HTTP ${logsRes.status}`;
    console.error(`[Sync] Failed: ${errMsg}`);
    await SyncState.findOneAndUpdate({}, { lastError: errMsg, lastErrorAt: new Date() });
    throw new Error(errMsg);
  }

  // Трекери
  if (trackersRes.ok) {
    const trackers = await trackersRes.json();
    await Tracker.deleteMany({});
    if (trackers.length) await Tracker.insertMany(trackers, { ordered: false });
    console.log(`[Sync] Trackers: ${trackers.length}`);
  }

  // Зони
  if (zonesRes.ok) {
    const zones = await zonesRes.json();
    await Zone.deleteMany({});
    if (zones.length) await Zone.insertMany(zones, { ordered: false });
    console.log(`[Sync] Zones: ${zones.length}`);
  }

  // Логи
  const { logs, count } = await logsRes.json();
  console.log(`[Sync] Received ${count} new log records`);

  let inserted = 0;
  if (count) {
    for (const log of logs) {
      try {
        await Log.create({
          imei: log.imei,
          latitude: log.latitude,
          longitude: log.longitude,
          speed: log.speed,
          direction: log.direction,
          deviceTime: log.deviceTime,
          raw: log.raw,
          cloudId: log._id,
        });
        inserted++;
      } catch {
        // duplicate — skip
      }
    }
    console.log(`[Sync] Inserted ${inserted} new log records`);
  }

  // Telegram повідомлення
  let telegramInserted = 0;
  let lastTelegramSync = state.lastTelegramSync;
  if (telegramRes.ok) {
    const { messages, count: tCount } = await telegramRes.json();
    console.log(`[Sync] Received ${tCount} new telegram messages`);
    for (const msg of messages) {
      try {
        await TelegramMessage.create({
          direction: msg.direction,
          telegramId: msg.telegramId,
          text: msg.text,
          status: msg.status,
          error: msg.error,
          metadata: msg.metadata,
          processedAt: msg.processedAt,
          cloudId: msg._id,
        });
        telegramInserted++;
      } catch {
        // duplicate — skip
      }
    }
    if (tCount) {
      lastTelegramSync = new Date(messages[messages.length - 1].createdAt);
      console.log(`[Sync] Inserted ${telegramInserted} telegram messages`);
    }
  }

  // Оновлюємо стан
  const updateData = {
    lastError: null,
    syncCount: state.syncCount + 1,
    totalSynced: state.totalSynced + inserted,
    lastTelegramSync,
  };

  if (count) {
    const lastLog = logs[logs.length - 1];
    updateData.lastSync = new Date(lastLog.createdAt);
  }

  await SyncState.findOneAndUpdate({}, updateData);
  return { received: count, inserted };
}

module.exports = { syncFromCloud };
