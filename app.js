require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const http = require("http");
const socketIo = require("socket.io");
const ChatMessage = require("./models/Chat");

// URL-Normalisierungsfunktion
function normalizeUrl(url) {
  if (!url) return url;

  // Entferne führende und nachfolgende Leerzeichen
  url = url.trim();

  // Wenn die URL bereits mit http:// oder https:// beginnt, behalte sie bei
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Wenn die URL mit // beginnt, füge https: hinzu
  if (url.startsWith("//")) {
    return "https:" + url;
  }

  // Füge https:// hinzu, wenn kein Protokoll angegeben ist
  return "https://" + url;
}

// Initialize Express!! :)
const app = express();
const server = http.createServer(app);

// CORS-Middleware - Wichtig für Vercel und Socket.IO
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );

  // Preflight-Anfragen direkt beantworten
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// EJS Setup
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// HTTP REST-API für Chat-Nachrichten
// Nachrichtenliste für eine bestimmte GameID abrufen
app.get("/api/messages/:gameId", async (req, res) => {
  try {
    const gameId = req.params.gameId;

    if (!gameId) {
      return res.status(400).json({ error: "Spiel-ID fehlt" });
    }

    const messages = await ChatMessage.find({ gameId })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    res.json(messages.reverse());
  } catch (error) {
    console.error("Fehler beim Abrufen der Nachrichten:", error);
    res
      .status(500)
      .json({ error: "Serverfehler beim Abrufen der Nachrichten" });
  }
});

// Neue Nachrichten seit einem bestimmten Zeitpunkt abrufen
app.get("/api/messages/:gameId/new", async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const since = req.query.since || new Date(0).toISOString();

    if (!gameId) {
      return res.status(400).json({ error: "Spiel-ID fehlt" });
    }

    const messages = await ChatMessage.find({
      gameId: gameId,
      timestamp: { $gt: new Date(since) },
    })
      .sort({ timestamp: 1 })
      .lean();

    res.json(messages);
  } catch (error) {
    console.error("Fehler beim Abrufen neuer Nachrichten:", error);
    res
      .status(500)
      .json({ error: "Serverfehler beim Abrufen neuer Nachrichten" });
  }
});

// Neue Nachricht senden
app.post("/api/messages/:gameId", async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const { text, username } = req.body;

    if (!gameId || !text) {
      return res.status(400).json({
        success: false,
        error: "Spiel-ID und Nachrichtentext sind erforderlich",
      });
    }

    const message = new ChatMessage({
      gameId: gameId,
      username: username || "Anonym",
      text: text.trim(),
      timestamp: new Date(),
    });

    await message.save();

    console.log("Nachricht gespeichert:", {
      gameId,
      username: message.username,
      text: message.text,
    });

    // Bei Socket.IO die Nachricht an alle Verbundenen senden
    // Falls Socket.IO aktiv ist (lokale Umgebung)
    if (io) {
      io.to(gameId).emit("chat message", {
        username: message.username,
        text: message.text,
        timestamp: message.timestamp,
      });
    }

    res.json({
      success: true,
      messageId: message._id.toString(),
    });
  } catch (error) {
    console.error("Fehler beim Speichern der Nachricht:", error);
    res.status(500).json({
      success: false,
      error: "Serverfehler beim Speichern der Nachricht",
    });
  }
});

// Socket.IO Konfiguration (nur für lokale Entwicklung)
const isVercel = process.env.VERCEL === "1";
let io;

if (!isVercel) {
  io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  console.log("Socket.IO für lokale Entwicklung initialisiert");

  // Socket.IO Chat Handling
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

        if (!gameId || !msg || typeof msg !== "string") {
          console.error("Ungültige Nachrichtendaten erhalten");
          if (typeof callback === "function") {
            callback({ success: false, error: "Ungültige Nachrichtendaten" });
          }
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
          console.log("Nachricht gespeichert:", {
            id: savedMessage._id.toString(),
            username: savedMessage.username,
            text: savedMessage.text,
          });

          io.to(gameId).emit("chat message", {
            username: savedMessage.username,
            text: savedMessage.text,
            timestamp: savedMessage.timestamp,
          });

          if (typeof callback === "function") {
            callback({ success: true, messageId: savedMessage._id.toString() });
          }
        } catch (err) {
          console.error("Fehler beim Speichern der Nachricht:", err);
          if (typeof callback === "function") {
            callback({
              success: false,
              error: "Nachricht konnte nicht gespeichert werden",
            });
          } else if (socket.connected) {
            socket.emit("error", "Nachricht konnte nicht gesendet werden");
          }
        }
      } catch (err) {
        console.error("Fehler bei der Nachrichtenverarbeitung:", err);
        if (typeof callback === "function") {
          callback({ success: false, error: "Interner Serverfehler" });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket getrennt: ${socket.id}`);
    });
  });
} else {
  console.log("Vercel-Umgebung erkannt, nur HTTP-API für Chat wird verwendet");
}

// API für Socket.IO Health Check (hauptsächlich für Debug)
app.get("/api/socketio", (req, res) => {
  res.json({
    status: "success",
    message: "API endpoint active",
    timestamp: new Date().toISOString(),
    env: isVercel ? "vercel" : "local",
    socketio_enabled: !isVercel,
  });
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// View Engine
app.use(expressLayouts);
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout");

// In-Memory Database in case MongoDB is not available
let inMemoryGames = [];
let useInMemoryDB = false; // Default auf false setzen

// Try to connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    dbName: "test",
  })
  .then(() => {
    console.log("MongoDB erfolgreich verbunden");
    useInMemoryDB = false;
  })
  .catch((err) => {
    console.error("MongoDB Verbindungsfehler:", err);
    console.log("Verwende In-Memory Datenbank als Fallback");
    useInMemoryDB = true;
  });

// Models
const Game = require("./models/Game");

// Routes
app.get("/", async (req, res) => {
  try {
    let games;
    if (useInMemoryDB) {
      games = inMemoryGames.sort((a, b) => b.votes - a.votes);
    } else {
      games = await Game.find().sort({ votes: -1, createdAt: -1 });
    }
    res.render("index", { games });
  } catch (err) {
    console.error("Fehler beim Laden der Spiele:", err);
    res.render("index", { games: [] });
  }
});

// Add game - Show form
app.get("/games/new", (req, res) => {
  res.render("new");
});

// Spielansicht Route
app.get("/games/:id/play", async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      console.log("Spiel nicht gefunden:", req.params.id);
      return res.status(404).render("error", {
        message: "Spiel nicht gefunden",
        error: { status: 404 },
      });
    }

    res.render("play", { game });
  } catch (err) {
    console.error("Fehler beim Laden des Spiels:", err);
    res.status(500).render("error", {
      message: "Fehler beim Laden des Spiels",
      error: { status: 500 },
    });
  }
});

// Add game - Process
app.post("/games", async (req, res) => {
  try {
    const { title, description, gameUrl, xProfile } = req.body;

    // Validierung
    if (!title || !description || !gameUrl) {
      return res.status(400).json({
        error: "Fehlende Pflichtfelder",
        details: "Titel, Beschreibung und Game-URL sind erforderlich",
      });
    }

    const newGame = new Game({
      title: title.trim(),
      description: description.trim(),
      gameUrl: normalizeUrl(gameUrl),
      xProfile: xProfile ? xProfile.trim() : "",
      votes: 0,
      createdAt: new Date(),
    });

    await newGame.save();
    console.log("Neues Spiel erfolgreich gespeichert:", newGame.title);
    res.redirect("/");
  } catch (err) {
    console.error("Fehler beim Speichern des Spiels:", err);
    res.status(500).json({
      error: "Fehler beim Speichern",
      details:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Interner Server-Fehler",
    });
  }
});

// Upvote game
app.post("/games/:id/upvote", async (req, res) => {
  try {
    const game = await Game.findByIdAndUpdate(
      req.params.id,
      { $inc: { votes: 1 } },
      { new: true }
    );

    if (!game) {
      return res.status(404).json({
        error: "Spiel nicht gefunden",
      });
    }

    res.redirect("/");
  } catch (err) {
    console.error("Fehler beim Upvoten:", err);
    res.status(500).json({
      error: "Fehler beim Upvoten",
      details:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Interner Server-Fehler",
    });
  }
});

// Downvote game
app.post("/games/:id/downvote", async (req, res) => {
  try {
    const game = await Game.findByIdAndUpdate(
      req.params.id,
      { $inc: { votes: -1 } },
      { new: true }
    );

    if (!game) {
      return res.status(404).json({
        error: "Spiel nicht gefunden",
      });
    }

    res.redirect("/");
  } catch (err) {
    console.error("Fehler beim Downvoten:", err);
    res.status(500).json({
      error: "Fehler beim Downvoten",
      details:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Interner Server-Fehler",
    });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Website available at http://localhost:${PORT}`);
});
