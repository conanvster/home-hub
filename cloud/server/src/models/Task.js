const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category:    { type: String, default: "" },
    priority: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      default: "medium",
    },
    column: {
      type: String,
      enum: ["idea", "in-progress", "done", "archive"],
      default: "idea",
    },
    type: {
      type: String,
      enum: ["idea", "task", "subtask"],
      default: "task",
    },
    parentTask:  { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    order:       { type: Number, default: 0 },
    linkedTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
    comments: [
      {
        text:      { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
