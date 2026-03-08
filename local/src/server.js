require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { connect } = require("./config/mongo");
const { syncFromCloud } = require("./services/sync");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/logs", require("./routes/logs"));
app.use("/api/trackers", require("./routes/trackers"));
app.use("/api/status", require("./routes/status"));
app.use("/api/zones", require("./routes/zones"));
app.use("/api/sync", require("./routes/sync"));
app.use("/api/telegram", require("./routes/telegram"));
app.use("/api/users", require("./routes/users"));
app.use("/api/backup", require("./routes/backup"));
app.use("/api/push", require("./routes/push"));
app.use("/api/tasks", require("./routes/tasks"));

const PORT = process.env.PORT || 3002;
const SYNC_CRON = process.env.SYNC_CRON || "0 * * * *";
const VERSION = `local@${process.env.GIT_COMMIT || "unknown"}`;

app.get("/api/version", (req, res) => res.json({ version: VERSION }));

async function main() {
  await connect();

  // Sync при старті (логи + трекери + зони)
  await syncFromCloud().catch(console.error);

  // Cron розклад
  cron.schedule(SYNC_CRON, () => syncFromCloud().catch(console.error));
  console.log(`[Sync] Scheduled: ${SYNC_CRON}`);

  app.listen(PORT, () => console.log(`[Server] Running on port ${PORT}`));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
