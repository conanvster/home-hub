const router = require("express").Router();
const Log = require("../models/Log");
const Tracker = require("../models/Tracker");
const Zone = require("../models/Zone");
const User = require("../models/User");
const TelegramMessage = require("../models/TelegramMessage");

// GET /api/backup — streaming JSON backup of all local collections
router.get("/", async (req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="home-hub-local-backup-${date}.json"`);

  const models = [
    ["logs", Log],
    ["trackers", Tracker],
    ["zones", Zone],
    ["users", User],
    ["telegrammessages", TelegramMessage],
  ];

  res.write(`{"version":"1.0","date":"${new Date().toISOString()}","collections":{`);
  for (let i = 0; i < models.length; i++) {
    const [name, Model] = models[i];
    res.write(`"${name}":[`);
    const cursor = Model.find().lean().cursor();
    let first = true;
    for await (const doc of cursor) {
      if (!first) res.write(",");
      res.write(JSON.stringify(doc));
      first = false;
    }
    res.write("]");
    if (i < models.length - 1) res.write(",");
  }
  res.write("}}");
  res.end();
});

module.exports = router;
