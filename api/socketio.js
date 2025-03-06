import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Import the Chat model
let ChatMessage;
try {
  ChatMessage =
    mongoose.models.ChatMessage ||
    mongoose.model("ChatMessage", require("../models/Chat"));
} catch (error) {
  console.error("Error loading Chat model:", error);
}

const ioHandler = async (req, res) => {
  // Nur CORS-Header und keine echte Logik für OPTIONS-Anfragen
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  console.log(
    `[${new Date().toISOString()}] Socket.IO API Handler aufgerufen: ${
      req.method
    }`
  );

  // Verzögerung hinzufügen, um die Verarbeitung zu verbessern
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (!res.socket.server.io) {
    console.log("Socket.IO-Initialisierung auf Vercel...");

    // Vercel-optimierte Socket.IO-Konfiguration
    const io = new Server(res.socket.server, {
      path: "/api/socketio",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["polling", "websocket"], // Polling zuerst für Vercel
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e8,
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

        // Prüfen, ob die Chat-Collection vorhanden ist
        try {
          const collections = await mongoose.connection.db
            .listCollections()
            .toArray();
          const collectionNames = collections.map((c) => c.name);
          console.log("Verfügbare Collections:", collectionNames);

          if (!collectionNames.includes("chats")) {
            console.log(
              "Die Collection 'chats' existiert noch nicht - wird automatisch erstellt"
            );
          }
        } catch (err) {
          console.error("Fehler beim Auflisten der Collections:", err);
        }
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
      console.log(
        `[${new Date().toISOString()}] Neue Socket-Verbindung: ${socket.id}`
      );
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

          // Stellen Sie sicher, dass die Verbindung noch aktiv ist, bevor Sie Daten senden
          if (socket.connected) {
            socket.emit("previous messages", messages.reverse());
          }
        } catch (err) {
          console.error("Fehler beim Laden der Nachrichten:", err);
          if (socket.connected) {
            socket.emit("error", "Nachrichten konnten nicht geladen werden");
          }
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

      socket.on("chat message", async (data, callback) => {
        try {
          const { gameId, msg } = data;

          console.log("Chat-Nachricht erhalten:", {
            gameId,
            msg,
            username: currentUsername,
          });

          if (!gameId || !msg || typeof msg !== "string") {
            console.error("Ungültige Nachrichtendaten erhalten");
            if (typeof callback === "function") {
              callback({ error: "Ungültige Nachrichtendaten" });
            }
            return;
          }

          try {
            // Prüfen, ob die Verbindung zur Datenbank besteht
            if (mongoose.connection.readyState !== 1) {
              console.error(
                "MongoDB nicht verbunden beim Speichern der Nachricht"
              );
              if (typeof callback === "function") {
                callback({ error: "Datenbankverbindung nicht verfügbar" });
              }
              return;
            }

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
              JSON.stringify({
                id: savedMessage._id.toString(),
                username: savedMessage.username,
                text: savedMessage.text,
                gameId: savedMessage.gameId,
                timestamp: savedMessage.timestamp,
              })
            );

            // Nachricht an alle Clients im Raum senden
            io.to(gameId).emit("chat message", {
              username: savedMessage.username,
              text: savedMessage.text,
              timestamp: savedMessage.timestamp,
            });

            // Bestätigung senden, wenn Callback vorhanden ist
            if (typeof callback === "function") {
              callback({
                success: true,
                messageId: savedMessage._id.toString(),
              });
            }
          } catch (err) {
            console.error("Fehler beim Speichern der Nachricht:", err);
            console.error("Fehlerdetails:", {
              name: err.name,
              message: err.message,
              stack: err.stack,
            });

            if (typeof callback === "function") {
              callback({ error: "Nachricht konnte nicht gespeichert werden" });
            } else if (socket.connected) {
              socket.emit("error", "Nachricht konnte nicht gesendet werden");
            }
          }
        } catch (err) {
          console.error(
            "Unerwarteter Fehler bei der Nachrichtenverarbeitung:",
            err
          );
          if (typeof callback === "function") {
            callback({ error: "Interner Serverfehler" });
          }
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

  // Respond with a success message
  res.status(200).json({
    status: "success",
    message: "Socket.IO initialized",
    timestamp: new Date().toISOString(),
    env: process.env.VERCEL === "1" ? "vercel" : "local",
  });
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default ioHandler;
