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

const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// View Engine
app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout");

// In-Memory Database in case MongoDB is not available
let inMemoryGames = [];
let useInMemoryDB = false; // Default auf false setzen

// Try to connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
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
