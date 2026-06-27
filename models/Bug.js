const mongoose = require("mongoose");

const bugSchema = new mongoose.Schema({
  endpoint: { type: String, required: true },
  message: { type: String, required: true },
  source: { type: String, required: true },
  status: { type: String, default: "New" },
  priority: { type: String, default: "P2" },
  count: { type: Number, default: 1 },
  account: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  archived: { type: Boolean, default: false },
  method: { type: String, default: "" },
  page: { type: String, default: "" },
  errorType: { type: String, default: "" },
  ticketId: { type: String, default: "" },
  ticketStatus: { type: String, default: "" },
  browser: { type: String, default: "" },
  lastSeen: { type: Date, default: Date.now },
  notes: { type: String, default: "" },
  resolvedAt: { type: Date, default: null },
  errorSignature: { type: String, default: "" }
});


module.exports = mongoose.model("Bug", bugSchema);