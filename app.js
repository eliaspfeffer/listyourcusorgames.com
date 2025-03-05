require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");

// Initialisiere Express
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

// MongoDB Verbindung
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB verbunden"))
  .catch((err) => console.error("MongoDB Verbindungsfehler:", err));

// Modelle
const Game = require("./models/Game");

// Routen
app.get("/", async (req, res) => {
  try {
    const games = await Game.find().sort({ votes: -1 });
    res.render("index", { games });
  } catch (err) {
    console.error(err);
    res.status(500).send("Serverfehler");
  }
});

// Spiel hinzufügen - Formular anzeigen
app.get("/games/new", (req, res) => {
  res.render("new");
});

// Spiel hinzufügen - Verarbeitung
app.post("/games", async (req, res) => {
  try {
    const newGame = new Game({
      title: req.body.title,
      description: req.body.description,
      gameUrl: req.body.gameUrl,
      imageUrl: req.body.imageUrl,
      xProfile: req.body.xProfile || "",
      votes: 0,
    });

    await newGame.save();
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Fehler beim Speichern des Spiels");
  }
});

// Spiel upvoten
app.post("/games/:id/upvote", async (req, res) => {
  try {
    await Game.findByIdAndUpdate(req.params.id, { $inc: { votes: 1 } });
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Fehler beim Upvoten");
  }
});

// Spiel downvoten
app.post("/games/:id/downvote", async (req, res) => {
  try {
    await Game.findByIdAndUpdate(req.params.id, { $inc: { votes: -1 } });
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Fehler beim Downvoten");
  }
});

// Server starten
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
