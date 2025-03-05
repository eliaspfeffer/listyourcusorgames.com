const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema({
  username: {
    type: String,
    default: "Anonym",
  },
  text: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  gameId: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
