const mongoose = require("mongoose");

module.exports = async function connectMongo() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/homehub";
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};
