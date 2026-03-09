const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  _id: { type: String, default: "default" },
  containers: [
    {
      id:       { type: String, required: true },
      name:     { type: String, default: "Контейнер" },
      entities: [String],
    },
  ],
});

module.exports = mongoose.model("HADashboard", schema);
