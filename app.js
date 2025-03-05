require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const http = require("http");
const socketIo = require("socket.io");

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
let inMemoryGames = [
  {
    _id: "game1",
    title: "Plane Battle Royale",
    description:
      "An exciting multiplayer airplane game where you battle against other players. Control your aircraft skillfully and shoot down your opponents!",
    gameUrl: "https://fly.pieter.com",
    xProfile: "@levelsio",
    votes: 0,
  },
];

let useInMemoryDB = true; // Use In-Memory DB by default

// Try to connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log("MongoDB connected successfully");
    useInMemoryDB = false;
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    console.log("Using In-Memory database as fallback");
    useInMemoryDB = true;
  });

// Models
const Game = require("./models/Game");

// Socket.IO nur lokal initialisieren
if (process.env.NODE_ENV !== "production") {
  const io = socketIo(server);

  // Chat-Nachrichten im Speicher
  const chatMessages = [];
  const MAX_MESSAGES = 50;

  // Socket.IO Chat-Handling
  io.on("connection", (socket) => {
    // Sende bisherige Nachrichten an neue Verbindungen
    socket.emit("previous messages", chatMessages);

    socket.on("set username", (username) => {
      socket.username = username;
    });

    socket.on("chat message", (msg) => {
      const message = {
        username: socket.username || "Anonym",
        text: msg,
        timestamp: new Date(),
      };

      chatMessages.push(message);
      // Behalte nur die letzten MAX_MESSAGES Nachrichten
      if (chatMessages.length > MAX_MESSAGES) {
        chatMessages.shift();
      }

      io.emit("chat message", message);
    });
  });
}

// Routes
app.get("/", async (req, res) => {
  try {
    let games;
    if (useInMemoryDB) {
      games = inMemoryGames.sort((a, b) => {
        if (b.votes === a.votes) {
          return b._id.localeCompare(a._id);
        }
        return b.votes - a.votes;
      });
    } else {
      games = await Game.find().sort({ votes: -1, _id: -1 });
    }
    res.render("index", { games });
  } catch (err) {
    console.error("Error loading games:", err);
    const games = inMemoryGames.sort((a, b) => {
      if (b.votes === a.votes) {
        return b._id.localeCompare(a._id);
      }
      return b.votes - a.votes;
    });
    res.render("index", { games });
  }
});

// Add game - Show form
app.get("/games/new", (req, res) => {
  res.render("new");
});

// Spielansicht Route
app.get("/games/:id/play", async (req, res) => {
  try {
    let game;
    if (useInMemoryDB) {
      game = inMemoryGames.find((g) => g._id === req.params.id);
    } else {
      game = await Game.findById(req.params.id);
    }

    if (!game) {
      return res.status(404).send("Game not found");
    }

    res.render("play", { game });
  } catch (err) {
    console.error("Error loading game:", err);
    res.status(500).send("Error loading game");
  }
});

// Add game - Process
app.post("/games", async (req, res) => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not set in environment variables");
    }

    if (useInMemoryDB) {
      const newGame = {
        _id: "game" + (inMemoryGames.length + 1),
        title: req.body.title,
        description: req.body.description,
        gameUrl: normalizeUrl(req.body.gameUrl),
        xProfile: req.body.xProfile || "",
        votes: 0,
      };
      inMemoryGames.push(newGame);
    } else {
      const newGame = new Game({
        title: req.body.title,
        description: req.body.description,
        gameUrl: normalizeUrl(req.body.gameUrl),
        xProfile: req.body.xProfile || "",
        votes: 0,
      });
      await newGame.save();
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error saving game:", err);
    res.status(500).json({
      error: "Error saving game",
      details:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  }
});

// Upvote game
app.post("/games/:id/upvote", async (req, res) => {
  try {
    if (useInMemoryDB) {
      const game = inMemoryGames.find((g) => g._id === req.params.id);
      if (game) {
        game.votes += 1;
      }
    } else {
      await Game.findByIdAndUpdate(req.params.id, { $inc: { votes: 1 } });
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error upvoting:", err);
    res.redirect("/");
  }
});

// Downvote game
app.post("/games/:id/downvote", async (req, res) => {
  try {
    if (useInMemoryDB) {
      const game = inMemoryGames.find((g) => g._id === req.params.id);
      if (game) {
        game.votes -= 1;
      }
    } else {
      await Game.findByIdAndUpdate(req.params.id, { $inc: { votes: -1 } });
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error downvoting:", err);
    res.redirect("/");
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Website available at http://localhost:${PORT}`);
});
