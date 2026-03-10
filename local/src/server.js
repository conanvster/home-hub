require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { connect } = require("./config/mongo");
const { syncFromCloud } = require("./services/sync");
const auth = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json());

// Публічні routes
app.use("/api/auth",   require("./routes/auth"));
app.use("/api/status", require("./routes/status"));
app.use("/api/sync",   require("./routes/sync")); // sync secret auth всередині

// Захищені routes (JWT)
app.use("/api/logs",     auth, require("./routes/logs"));
app.use("/api/trackers", auth, require("./routes/trackers"));
app.use("/api/zones",    auth, require("./routes/zones"));
app.use("/api/telegram", auth, require("./routes/telegram"));
app.use("/api/users",    auth, require("./routes/users"));
app.use("/api/backup",   auth, require("./routes/backup"));
app.use("/api/push",     auth, require("./routes/push"));
app.use("/api/tasks",    auth, require("./routes/tasks"));
app.use("/api/ha",       auth, require("./routes/ha"));

const PORT = process.env.PORT || 3002;
const SYNC_CRON = process.env.SYNC_CRON || "0 * * * *";
const VERSION = `local@${process.env.GIT_COMMIT || "unknown"}`;

app.get("/api/version", (req, res) => res.json({ version: VERSION }));

async function main() {
  await connect();

  // Sync при старті
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
