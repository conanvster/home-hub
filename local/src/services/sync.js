const Log = require("../models/Log");
const SyncState = require("../models/SyncState");

const CLOUD_URL = process.env.CLOUD_URL || "https://mytracking.com.ua";
const SYNC_SECRET = process.env.SYNC_SECRET;

async function syncFromCloud() {
  const state = await SyncState.get();
  const since = state.lastSync ? state.lastSync.toISOString() : null;
  const url = `${CLOUD_URL}/api/sync${since ? `?since=${since}` : ""}`;

  console.log(`[${new Date().toISOString()}] Syncing from cloud...`);

  let res;
  try {
    res = await fetch(url, {
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

  const { logs, count } = await res.json();
  console.log(`[Sync] Received ${count} new records`);

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

  console.log(`[Sync] Inserted ${inserted} new records`);

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
