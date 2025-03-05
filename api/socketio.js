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
    console.log("Socket.IO-Initialisierung...");

    const io = new Server(res.socket.server, {
      path: "/api/socketio",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

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
      console.log("Neue Socket-Verbindung:", socket.id);

      // Raum betreten wenn ein Spiel geöffnet wird
      socket.on("join game", async (gameId) => {
        if (!gameId) {
          console.error("Keine gameId beim Join-Event");
          return;
        }

        socket.join(gameId);
        console.log(`Socket ${socket.id} ist Spiel beigetreten: ${gameId}`);

        // Lade vorherige Nachrichten für dieses Spiel
        try {
          const messages = await ChatMessage.find({ gameId })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();
          socket.emit("previous messages", messages.reverse());
        } catch (err) {
          console.error("Fehler beim Laden der Nachrichten:", err);
          socket.emit("error", "Fehler beim Laden der Nachrichten");
        }
      });

      socket.on("set username", (username) => {
        if (typeof username === "string" && username.trim()) {
          socket.username = username.trim();
          console.log(`Username gesetzt für Socket ${socket.id}: ${username}`);
        }
      });

      socket.on("chat message", async ({ gameId, msg }) => {
        if (!gameId || !msg || typeof msg !== "string") {
          console.error("Ungültige Nachricht oder gameId");
          return;
        }

        try {
          const message = new ChatMessage({
            username: socket.username || "Anonym",
            text: msg.trim(),
            gameId: gameId,
            timestamp: new Date(),
          });

          await message.save();
          console.log(`Nachricht gespeichert für Spiel ${gameId}`);

          // Sende die Nachricht nur an Clients im gleichen Spiel-Raum
          io.to(gameId).emit("chat message", {
            username: message.username,
            text: message.text,
            timestamp: message.timestamp,
          });
        } catch (err) {
          console.error("Fehler beim Speichern der Nachricht:", err);
          socket.emit("error", "Fehler beim Senden der Nachricht");
        }
      });

      socket.on("disconnect", () => {
        console.log(`Socket getrennt: ${socket.id}`);
      });
    });
  }
  res.end();
};

export default ioHandler;
