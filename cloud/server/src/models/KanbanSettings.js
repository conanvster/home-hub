const mongoose = require("mongoose");

const kanbanSettingsSchema = new mongoose.Schema({
  _id:        { type: String },
  categories: { type: [String], default: ["home-hub", "будинок", "авто", "сад", "інше"] },
});

module.exports = mongoose.model("KanbanSettings", kanbanSettingsSchema);
