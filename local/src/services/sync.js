const Log = require("../models/Log");
const Tracker = require("../models/Tracker");
const Zone = require("../models/Zone");
const TelegramMessage = require("../models/TelegramMessage");
const User = require("../models/User");
const SyncState = require("../models/SyncState");

const CLOUD_URL = process.env.CLOUD_URL || "https://mytracking.com.ua";
const SYNC_SECRET = process.env.SYNC_SECRET;

async function syncFromCloud() {
  const state = await SyncState.get();

  const params = new URLSearchParams();
  if (state.lastSync) params.set("since", state.lastSync.toISOString());
  if (state.lastTelegramSync) params.set("telegramSince", state.lastTelegramSync.toISOString());

  console.log(`[${new Date().toISOString()}] Syncing from cloud...`);

  let res;
  try {
    res = await fetch(`${CLOUD_URL}/api/sync?${params}`, {
      headers: { "x-sync-secret": SYNC_SECRET },
    });
  } catch (err) {
    const errMsg = `Network error: ${err.message}`;
    console.error(`[Sync] ${errMsg}`);
    await SyncState.findOneAndUpdate({}, { lastError: errMsg, lastErrorAt: new Date() });
    throw new Error(errMsg);
  }

  if (!res.ok) {
    const errMsg = `HTTP ${res.status}`;
    console.error(`[Sync] Failed: ${errMsg}`);
    await SyncState.findOneAndUpdate({}, { lastError: errMsg, lastErrorAt: new Date() });
    throw new Error(errMsg);
  }

  const data = await res.json();

  // Трекери — повна заміна
  await Tracker.deleteMany({});
  if (data.trackers.length) await Tracker.insertMany(data.trackers, { ordered: false });
  console.log(`[Sync] Trackers: ${data.trackers.length}`);

  // Зони — повна заміна
  await Zone.deleteMany({});
  if (data.zones.length) await Zone.insertMany(data.zones, { ordered: false });
  console.log(`[Sync] Zones: ${data.zones.length}`);

  // Користувачі — повна заміна
  await User.deleteMany({});
  const userDocs = data.users.map((u) => ({
    email: u.email,
    role: u.role,
    telegramId: u.telegramId,
    passwordHash: u.password,
    cloudId: u._id,
    createdAt: u.createdAt,
  }));
  if (userDocs.length) await User.insertMany(userDocs, { ordered: false });
  console.log(`[Sync] Users: ${data.users.length}`);

  // GPS логи — інкрементально
  const { count, items: logs } = data.logs;
  console.log(`[Sync] Received ${count} new log records`);
  let inserted = 0;
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
  if (count) console.log(`[Sync] Inserted ${inserted} new log records`);

  // Telegram — інкрементально
  const { count: tCount, items: messages } = data.telegram;
  console.log(`[Sync] Received ${tCount} new telegram messages`);
  let telegramInserted = 0;
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
  if (tCount) console.log(`[Sync] Inserted ${telegramInserted} telegram messages`);

  // Оновлюємо стан
  const updateData = {
    lastError: null,
    syncCount: state.syncCount + 1,
    totalSynced: state.totalSynced + inserted,
  };
  if (count) updateData.lastSync = new Date(logs[logs.length - 1].createdAt);
  if (tCount) updateData.lastTelegramSync = new Date(messages[messages.length - 1].createdAt);

  await SyncState.findOneAndUpdate({}, updateData);
  return { received: count, inserted };
}

module.exports = { syncFromCloud };
