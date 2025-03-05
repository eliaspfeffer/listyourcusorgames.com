require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");

// Initialize Express!! :)
const app = express();
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
    title: "Pixel Jumper",
    description:
      "An AI-generated platform game in retro style. Jump over obstacles and collect coins!",
    gameUrl: "https://example.com/pixeljumper",
    imageUrl: "https://via.placeholder.com/300x200.png?text=Pixel+Jumper",
    xProfile: "@pixeljumper",
    votes: 15,
  },
  {
    _id: "game2",
    title: "Space Invaders AI",
    description:
      "A modern AI interpretation of the classic Space Invaders with procedurally generated enemies.",
    gameUrl: "https://example.com/spaceinvaders",
    imageUrl: "https://via.placeholder.com/300x200.png?text=Space+Invaders+AI",
    xProfile: "@aispacegames",
    votes: 23,
  },
  {
    _id: "game3",
    title: "Dungeon Explorer",
    description:
      "Explore procedurally generated dungeons in this roguelike game that was entirely created by an AI.",
    gameUrl: "https://example.com/dungeonexplorer",
    imageUrl: "https://via.placeholder.com/300x200.png?text=Dungeon+Explorer",
    xProfile: "@dungeonai",
    votes: 8,
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

// Routes
app.get("/", async (req, res) => {
  try {
    let games;
    if (useInMemoryDB) {
      games = inMemoryGames.sort((a, b) => b.votes - a.votes);
    } else {
      games = await Game.find().sort({ votes: -1 });
    }
    res.render("index", { games });
  } catch (err) {
    console.error("Error loading games:", err);
    // Fallback to In-Memory DB on error
    const games = inMemoryGames.sort((a, b) => b.votes - a.votes);
    res.render("index", { games });
  }
});

// Add game - Show form
app.get("/games/new", (req, res) => {
  res.render("new");
});

// Add game - Process
app.post("/games", async (req, res) => {
  try {
    if (useInMemoryDB) {
      const newGame = {
        _id: "game" + (inMemoryGames.length + 1),
        title: req.body.title,
        description: req.body.description,
        gameUrl: req.body.gameUrl,
        imageUrl: req.body.imageUrl,
        xProfile: req.body.xProfile || "",
        votes: 0,
      };
      inMemoryGames.push(newGame);
    } else {
      const newGame = new Game({
        title: req.body.title,
        description: req.body.description,
        gameUrl: req.body.gameUrl,
        imageUrl: req.body.imageUrl,
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Website available at http://localhost:${PORT}`);
});
