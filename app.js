require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const http = require("http");
const socketIo = require("socket.io");
const multer = require("multer");
const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs").promises;

// URL-Normalisierungsfunktion
function normalizeUrl(url) {
  if (!url) return url;

  // Entferne führende und nachfolgende Leerzeichen
  url = url.trim();

  // Wenn keine Protokoll-Angabe vorhanden ist, füge https:// hinzu
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  return url;
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
      "Ein spannendes Multiplayer-Flugzeugspiel, in dem du gegen andere Spieler kämpfst. Steuere dein Flugzeug geschickt und schieße deine Gegner ab!",
    gameUrl: "https://fly.pieter.com",
    imageUrl: "https://fly.pieter.com/preview.png",
    xProfile: "@levelsio",
    votes: 0,
  },
];

let useInMemoryDB = true; // Use In-Memory DB by default

// Try to connect to MongoDB
try {
  mongoose
    .connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Reduce timeout to 5 seconds
    })
    .then(() => {
      console.log("MongoDB connected");
      useInMemoryDB = false;
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err);
      console.log("Using In-Memory database as fallback");
      useInMemoryDB = true;
    });
} catch (err) {
  console.error("Error connecting to MongoDB:", err);
  console.log("Using In-Memory database as fallback");
  useInMemoryDB = true;
}

// Models
let Game;
try {
  Game = require("./models/Game");
} catch (err) {
  console.error("Error loading Game model:", err);
}

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

// Add game - Show form (Diese Route muss VOR der :id Route kommen)
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
      return res.status(404).send("Spiel nicht gefunden");
    }

    res.render("play", { game });
  } catch (err) {
    console.error("Error loading game:", err);
    res.status(500).send("Fehler beim Laden des Spiels");
  }
});

// Multer Konfiguration für Bild-Upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Nur Bilder sind erlaubt!"), false);
    }
  },
});

// Erstelle Upload-Verzeichnis, falls es nicht existiert
(async () => {
  try {
    await fs.mkdir("public/uploads", { recursive: true });
  } catch (err) {
    console.error("Fehler beim Erstellen des Upload-Verzeichnisses:", err);
  }
})();

// Funktion zum Abrufen eines zufälligen Cat GIFs
async function getRandomCatGif() {
  try {
    const response = await axios.get(
      "https://api.thecatapi.com/v1/images/search?mime_types=gif"
    );
    return response.data[0].url;
  } catch (err) {
    console.error("Fehler beim Abrufen des Cat GIFs:", err);
    return "https://http.cat/404"; // Fallback, falls Cat API nicht funktioniert
  }
}

// Add game - Process
app.post("/games", upload.single("image"), async (req, res) => {
  try {
    let imageUrl;

    if (req.file) {
      // Wenn ein Bild hochgeladen wurde, verarbeite es
      const resizedImagePath = "public/uploads/resized-" + req.file.filename;
      await sharp(req.file.path)
        .resize(300, 200, { fit: "inside" })
        .toFile(resizedImagePath);

      // Lösche das Original und verwende das verkleinerte Bild
      await fs.unlink(req.file.path);
      imageUrl = "/uploads/resized-" + req.file.filename;
    } else if (req.body.imageUrl) {
      // Wenn eine URL angegeben wurde
      imageUrl = normalizeUrl(req.body.imageUrl);
    } else {
      // Wenn kein Bild angegeben wurde, verwende ein zufälliges Cat GIF
      imageUrl = await getRandomCatGif();
    }

    if (useInMemoryDB) {
      const newGame = {
        _id: "game" + (inMemoryGames.length + 1),
        title: req.body.title,
        description: req.body.description,
        gameUrl: normalizeUrl(req.body.gameUrl),
        imageUrl: imageUrl,
        xProfile: req.body.xProfile || "",
        votes: 0,
      };
      inMemoryGames.push(newGame);
    } else {
      const newGame = new Game({
        title: req.body.title,
        description: req.body.description,
        gameUrl: normalizeUrl(req.body.gameUrl),
        imageUrl: imageUrl,
        xProfile: req.body.xProfile || "",
        votes: 0,
      });
      await newGame.save();
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error saving game:", err);
    res.status(500).send("Error saving game");
  }
});

// Bild ändern Route
app.post(
  "/games/:id/update-image",
  upload.single("image"),
  async (req, res) => {
    try {
      let game;
      let imageUrl;

      if (req.file) {
        // Wenn ein Bild hochgeladen wurde, verarbeite es
        const resizedImagePath = "public/uploads/resized-" + req.file.filename;
        await sharp(req.file.path)
          .resize(300, 200, { fit: "inside" })
          .toFile(resizedImagePath);

        // Lösche das Original und verwende das verkleinerte Bild
        await fs.unlink(req.file.path);
        imageUrl = "/uploads/resized-" + req.file.filename;
      } else if (req.body.imageUrl) {
        // Wenn eine URL angegeben wurde
        imageUrl = normalizeUrl(req.body.imageUrl);
      } else {
        // Wenn kein Bild angegeben wurde, verwende ein zufälliges Cat GIF
        imageUrl = await getRandomCatGif();
      }

      if (useInMemoryDB) {
        game = inMemoryGames.find((g) => g._id === req.params.id);
        if (game) {
          // Lösche altes Bild, wenn es ein Upload war
          if (game.imageUrl.startsWith("/uploads/")) {
            try {
              await fs.unlink("public" + game.imageUrl);
            } catch (err) {
              console.error("Fehler beim Löschen des alten Bildes:", err);
            }
          }
          game.imageUrl = imageUrl;
        }
      } else {
        const oldGame = await Game.findById(req.params.id);
        if (oldGame && oldGame.imageUrl.startsWith("/uploads/")) {
          try {
            await fs.unlink("public" + oldGame.imageUrl);
          } catch (err) {
            console.error("Fehler beim Löschen des alten Bildes:", err);
          }
        }
        await Game.findByIdAndUpdate(req.params.id, { imageUrl: imageUrl });
      }

      res.redirect("/");
    } catch (err) {
      console.error("Error updating image:", err);
      res.status(500).send("Error updating image");
    }
  }
);

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

// Start server (ändern Sie app.listen zu server.listen)
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Website available at http://localhost:${PORT}`);
});
