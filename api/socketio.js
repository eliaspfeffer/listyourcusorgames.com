import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Chat Message Schema
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

// Erstelle das Modell nur, wenn es noch nicht existiert
const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model("ChatMessage", chatMessageSchema);

const ioHandler = async (req, res) => {
  if (!res.socket.server.io) {
    console.log("Erste Socket.IO-Initialisierung");
    const io = new Server(res.socket.server);
    res.socket.server.io = io;

    // Verbinde mit MongoDB, wenn noch nicht verbunden
    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(process.env.MONGODB_URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        console.log("MongoDB connected in socket handler");
      } catch (err) {
        console.error("MongoDB connection error in socket handler:", err);
      }
    }

    io.on("connection", (socket) => {
      console.log("Neue Socket-Verbindung");

      // Raum betreten wenn ein Spiel geöffnet wird
      socket.on("join game", async (gameId) => {
        socket.join(gameId);
        console.log(`Socket joined game: ${gameId}`);

        // Lade vorherige Nachrichten für dieses Spiel
        try {
          const messages = await ChatMessage.find({ gameId })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();
          socket.emit("previous messages", messages.reverse());
        } catch (err) {
          console.error("Error loading messages:", err);
        }
      });

      socket.on("set username", (username) => {
        socket.username = username;
      });

      socket.on("chat message", async ({ gameId, msg }) => {
        try {
          const message = new ChatMessage({
            username: socket.username || "Anonym",
            text: msg,
            gameId: gameId,
            timestamp: new Date(),
          });

          await message.save();

          // Sende die Nachricht nur an Clients im gleichen Spiel-Raum
          io.to(gameId).emit("chat message", {
            username: message.username,
            text: message.text,
            timestamp: message.timestamp,
          });
        } catch (err) {
          console.error("Error saving chat message:", err);
        }
      });
    });
  }
  res.end();
};

export default ioHandler;
