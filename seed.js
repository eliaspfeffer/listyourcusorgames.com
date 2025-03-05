require("dotenv").config();
const mongoose = require("mongoose");
const Game = require("./models/Game");

// Beispiel-Spiele
const sampleGames = [
  {
    title: "Pixel Jumper",
    description:
      "Ein KI-generiertes Jump-and-Run-Spiel im Retro-Stil. Springe über Hindernisse und sammle Münzen!",
    gameUrl: "https://example.com/pixeljumper",
    imageUrl: "https://via.placeholder.com/300x200.png?text=Pixel+Jumper",
    xProfile: "@pixeljumper",
    votes: 15,
  },
  {
    title: "Space Invaders AI",
    description:
      "Eine moderne KI-Interpretation des Klassikers Space Invaders mit prozedural generierten Gegnern.",
    gameUrl: "https://example.com/spaceinvaders",
    imageUrl: "https://via.placeholder.com/300x200.png?text=Space+Invaders+AI",
    xProfile: "@aispacegames",
    votes: 23,
  },
  {
    title: "Dungeon Explorer",
    description:
      "Erkunde prozedural generierte Dungeons in diesem Roguelike-Spiel, das vollständig von einer KI erstellt wurde.",
    gameUrl: "https://example.com/dungeonexplorer",
    imageUrl: "https://via.placeholder.com/300x200.png?text=Dungeon+Explorer",
    xProfile: "@dungeonai",
    votes: 8,
  },
  {
    title: "Retro Racer",
    description:
      "Ein Rennspiel im Stil der 80er Jahre mit KI-generierten Strecken und Fahrzeugen.",
    gameUrl: "https://example.com/retroracer",
    imageUrl: "https://via.placeholder.com/300x200.png?text=Retro+Racer",
    xProfile: "@retroracergame",
    votes: 19,
  },
  {
    title: "AI Chess Master",
    description:
      "Schach gegen eine KI, die nicht nur spielt, sondern auch das Spieldesign erstellt hat.",
    gameUrl: "https://example.com/aichess",
    imageUrl: "https://via.placeholder.com/300x200.png?text=AI+Chess+Master",
    xProfile: "",
    votes: 12,
  },
];

// Verbindung zur Datenbank herstellen
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("MongoDB verbunden");

    try {
      // Bestehende Spiele löschen
      await Game.deleteMany({});
      console.log("Bestehende Spiele gelöscht");

      // Beispiel-Spiele einfügen
      await Game.insertMany(sampleGames);
      console.log("Beispiel-Spiele eingefügt");

      // Verbindung schließen
      mongoose.connection.close();
      console.log("Seed abgeschlossen");
    } catch (error) {
      console.error("Fehler beim Seeden der Datenbank:", error);
    }
  })
  .catch((err) => {
    console.error("MongoDB Verbindungsfehler:", err);
  });
