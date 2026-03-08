const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  _id: { type: String, default: "kanban" },
  categories: { type: [String], default: ["home-hub", "будинок", "авто", "сад", "інше"] },
});

module.exports = mongoose.model("KanbanSettings", schema);
