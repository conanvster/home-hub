const mongoose = require("mongoose");

async function connect() {
  const uri = process.env.MONGO_URI || "mongodb://mongo:27017/homehub_local";
  mongoose.connection.on("connected", () => console.log("[MongoDB] Connected"));
  mongoose.connection.on("error", (err) => console.error("[MongoDB] Error:", err.message));
  await mongoose.connect(uri);
}

module.exports = { connect };
