const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      default: "Anonym",
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    gameId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "chats",
    versionKey: false,
  }
);

// Compound index for faster queries
chatMessageSchema.index({ gameId: 1, timestamp: -1 });

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

module.exports = ChatMessage;
