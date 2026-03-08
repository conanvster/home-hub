const Log = require("../models/Log");
const Tracker = require("../models/Tracker");
const Zone = require("../models/Zone");
const User = require("../models/User");
const TelegramMessage = require("../models/TelegramMessage");

const CLOUD_URL = process.env.CLOUD_URL || "https://mytracking.com.ua";
const SYNC_SECRET = process.env.SYNC_SECRET;
const LOG_BATCH_SIZE = 10000;

// Shared push state for progress tracking
const pushState = {
  running: false,
  step: null,       // "meta" | "logs" | "done" | "error"
  logsSent: 0,
  logsTotal: 0,
  error: null,
  startedAt: null,
  finishedAt: null,
};

function getStatus() {
  return { ...pushState };
}

async function pushToCloud() {
  if (pushState.running) throw new Error("Push already in progress");

  Object.assign(pushState, {
    running: true,
    step: "meta",
    logsSent: 0,
    logsTotal: 0,
    error: null,
    startedAt: new Date(),
    finishedAt: null,
  });

  const headers = {
    "Content-Type": "application/json",
    "x-sync-secret": SYNC_SECRET,
  };

  try {
    // 1. Push meta (trackers, zones, users, telegram)
    const [trackers, zones, users, telegram] = await Promise.all([
      Tracker.find().lean(),
      Zone.find().lean(),
      User.find().lean(),
      TelegramMessage.find().lean(),
    ]);

    console.log(`[Push] Meta: ${trackers.length} trackers, ${zones.length} zones, ${users.length} users, ${telegram.length} telegram`);

    const metaRes = await fetch(`${CLOUD_URL}/api/sync/restore/meta`, {
      method: "POST",
      headers,
      body: JSON.stringify({ trackers, zones, users, telegram }),
    });

    if (!metaRes.ok) {
      const body = await metaRes.text();
      throw new Error(`Meta restore failed: HTTP ${metaRes.status} ${body}`);
    }

    // 2. Push logs in batches
    pushState.step = "logs";
    pushState.logsTotal = await Log.countDocuments();
    console.log(`[Push] Logs total: ${pushState.logsTotal}`);

    let offset = 0;
    let firstBatch = true;

    while (offset < pushState.logsTotal) {
      const batch = await Log.find()
        .sort({ createdAt: 1 })
        .skip(offset)
        .limit(LOG_BATCH_SIZE)
        .lean();

      if (!batch.length) break;

      const logsRes = await fetch(`${CLOUD_URL}/api/sync/restore/logs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ items: batch, clear: firstBatch }),
      });

      if (!logsRes.ok) {
        const body = await logsRes.text();
        throw new Error(`Logs restore failed at offset ${offset}: HTTP ${logsRes.status} ${body}`);
      }

      const { inserted } = await logsRes.json();
      offset += batch.length;
      pushState.logsSent = offset;
      firstBatch = false;
      console.log(`[Push] Logs: ${offset}/${pushState.logsTotal} (inserted ${inserted})`);
    }

    pushState.step = "done";
    pushState.finishedAt = new Date();
    console.log(`[Push] Complete. ${pushState.logsTotal} logs pushed to cloud.`);
  } catch (err) {
    pushState.step = "error";
    pushState.error = err.message;
    pushState.finishedAt = new Date();
    console.error(`[Push] Failed: ${err.message}`);
  } finally {
    pushState.running = false;
  }
}

module.exports = { pushToCloud, getStatus };
