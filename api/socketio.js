import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Import the Chat model
const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model("ChatMessage", require("../models/Chat"));

const ioHandler = async (req, res) => {
  console.log("Socket.IO API Handler aufgerufen");

  // Verzögerung hinzufügen, um die Verarbeitung zu verbessern
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (!res.socket.server.io) {
    console.log("Socket.IO-Initialisierung...");

    const io = new Server(res.socket.server, {
      path: "/api/socketio",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    // Ensure MongoDB connection
    try {
      if (mongoose.connection.readyState !== 1) {
        console.log("Verbindung zu MongoDB wird hergestellt...");
        await mongoose.connect(process.env.MONGODB_URI, {
          dbName: "test",
        });
        console.log("MongoDB erfolgreich verbunden!");
        console.log("Datenbank:", mongoose.connection.db.databaseName);
      } else {
        console.log("MongoDB bereits verbunden");
      }
    } catch (err) {
      console.error("MongoDB Verbindungsfehler:", err);
      return res
        .status(500)
        .json({ error: "Datenbankverbindung fehlgeschlagen" });
    }

    io.on("connection", (socket) => {
      console.log("Neue Socket-Verbindung:", socket.id);
      let currentUsername = "Anonym";

      socket.on("join game", async (gameId) => {
        if (!gameId) {
          console.error("Keine gameId für Join-Event angegeben");
          return;
        }

        try {
          socket.join(gameId);
          console.log(`Socket ${socket.id} ist Spiel beigetreten: ${gameId}`);

          const messages = await ChatMessage.find({ gameId })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();

          console.log(
            `${messages.length} Nachrichten für Spiel ${gameId} gefunden`
          );
          socket.emit("previous messages", messages.reverse());
        } catch (err) {
          console.error("Fehler beim Laden der Nachrichten:", err);
          socket.emit("error", "Nachrichten konnten nicht geladen werden");
        }
      });

      socket.on("set username", (username) => {
        if (typeof username === "string" && username.trim()) {
          currentUsername = username.trim();
          console.log(
            `Benutzername für Socket ${socket.id} gesetzt: ${currentUsername}`
          );
        }
      });

      socket.on("chat message", async ({ gameId, msg }) => {
        console.log("Chat-Nachricht erhalten:", {
          gameId,
          msg,
          username: currentUsername,
        });

        if (!gameId || !msg || typeof msg !== "string") {
          console.error("Ungültige Nachrichtendaten erhalten");
          return;
        }

        try {
          const message = new ChatMessage({
            username: currentUsername,
            text: msg.trim(),
            gameId: gameId,
            timestamp: new Date(),
          });

          console.log("Speichere Nachricht...");
          const savedMessage = await message.save();
          console.log(
            "Nachricht erfolgreich gespeichert:",
            JSON.stringify(savedMessage)
          );

          io.to(gameId).emit("chat message", {
            username: savedMessage.username,
            text: savedMessage.text,
            timestamp: savedMessage.timestamp,
          });
        } catch (err) {
          console.error("Fehler beim Speichern der Nachricht:", err);
          socket.emit("error", "Nachricht konnte nicht gesendet werden");
        }
      });

      socket.on("disconnect", () => {
        console.log(`Socket getrennt: ${socket.id}`);
      });
    });

    res.socket.server.io = io;
    console.log(
      "Socket.IO-Server initialisiert und an res.socket.server.io zugewiesen"
    );
  } else {
    console.log("Socket.IO-Server bereits initialisiert");
  }

  res.status(200).json({ success: true });
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default ioHandler;
