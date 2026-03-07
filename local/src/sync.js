require("dotenv").config();
const cron = require("node-cron");
const mongoose = require("mongoose");

const CLOUD_URL = process.env.CLOUD_URL || "https://mytracking.com.ua";
const SYNC_SECRET = process.env.SYNC_SECRET;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/homehub_local";
const SYNC_CRON = process.env.SYNC_CRON || "0 * * * *"; // кожну годину

// Local Log schema (mirror of cloud)
const logSchema = new mongoose.Schema(
  {
    imei: String,
    latitude: Number,
    longitude: Number,
    speed: Number,
    direction: Number,
    deviceTime: Date,
    raw: String,
    cloudId: { type: String, unique: true }, // _id з хмари
  },
  { timestamps: true }
);
const Log = mongoose.model("Log", logSchema);

// State: last sync timestamp
const stateSchema = new mongoose.Schema({ key: String, value: String });
const State = mongoose.model("State", stateSchema);

async function getLastSync() {
  const state = await State.findOne({ key: "lastSync" });
  return state?.value || null;
}

async function setLastSync(iso) {
  await State.findOneAndUpdate(
    { key: "lastSync" },
    { value: iso },
    { upsert: true }
  );
}

async function syncFromCloud() {
  const since = await getLastSync();
  const url = `${CLOUD_URL}/api/sync${since ? `?since=${since}` : ""}`;

  console.log(`[${new Date().toISOString()}] Syncing from cloud...`);

  const res = await fetch(url, {
    headers: { "x-sync-secret": SYNC_SECRET },
  });

  if (!res.ok) {
    console.error(`Sync failed: HTTP ${res.status}`);
    return;
  }

  const { logs, count } = await res.json();
  console.log(`Received ${count} new records`);

  if (!count) return;

  // Insert new logs (skip duplicates)
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

  console.log(`Inserted ${inserted} new records locally`);

  // Update last sync to the latest createdAt
  const lastLog = logs[logs.length - 1];
  await setLastSync(lastLog.createdAt);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Local MongoDB connected");

  // Run immediately on start
  await syncFromCloud().catch(console.error);

  // Then schedule
  cron.schedule(SYNC_CRON, () => {
    syncFromCloud().catch(console.error);
  });

  console.log(`Sync scheduled: ${SYNC_CRON}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
