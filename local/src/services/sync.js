const Log = require("../models/Log");
const Tracker = require("../models/Tracker");
const Zone = require("../models/Zone");
const SyncState = require("../models/SyncState");

const CLOUD_URL = process.env.CLOUD_URL || "https://mytracking.com.ua";
const SYNC_SECRET = process.env.SYNC_SECRET;

async function syncFromCloud() {
  const state = await SyncState.get();
  const since = state.lastSync ? state.lastSync.toISOString() : null;

  console.log(`[${new Date().toISOString()}] Syncing from cloud...`);

  const headers = { "x-sync-secret": SYNC_SECRET };

  // Паралельно: трекери, зони і нові логи
  let logsRes, trackersRes, zonesRes;
  try {
    const logsUrl = `${CLOUD_URL}/api/sync${since ? `?since=${since}` : ""}`;
    [logsRes, trackersRes, zonesRes] = await Promise.all([
      fetch(logsUrl, { headers }),
      fetch(`${CLOUD_URL}/api/sync/trackers`, { headers }),
      fetch(`${CLOUD_URL}/api/sync/zones`, { headers }),
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

  if (!count) {
    await SyncState.findOneAndUpdate({}, {
      lastError: null,
      syncCount: state.syncCount + 1,
    });
    return { received: 0, inserted: 0 };
  }

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

  console.log(`[Sync] Inserted ${inserted} new log records`);

  const lastLog = logs[logs.length - 1];
  await SyncState.findOneAndUpdate({}, {
    lastSync: new Date(lastLog.createdAt),
    totalSynced: state.totalSynced + inserted,
    lastError: null,
    syncCount: state.syncCount + 1,
  });
  return { received: count, inserted };
}

module.exports = { syncFromCloud };
