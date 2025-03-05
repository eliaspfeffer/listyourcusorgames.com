# ListYourAIGames.com

Eine Retro-Style-Website zum Auflisten von KI-generierten Minispielen, inspiriert von Plattformen wie Miniclips und Spieleaffe.

## Funktionen

- Auflisten von KI-generierten Minispielen im Retro-Stil
- Hinzufügen von Spielen ohne Anmeldung
- Voting-System (Up/Down) ohne Anmeldung
- Möglichkeit, X (Twitter) Profile zu verlinken
- Responsive Design für alle Geräte
- Retro-Stil-UI mit pixeligen Elementen und Retro-Sounds

## Technologien

- Node.js
- Express.js
- MongoDB
- EJS Templates
- CSS3 mit Retro-Styling
- Vanilla JavaScript

## Installation

1. Repository klonen:

```
git clone https://github.com/yourusername/listyouraigames.com.git
cd listyouraigames.com
```

2. Abhängigkeiten installieren:

```
npm install
```

3. MongoDB einrichten:

   - Stelle sicher, dass MongoDB auf deinem System installiert ist
   - Erstelle eine Datenbank namens "listyouraigames"

4. Umgebungsvariablen konfigurieren:

   - Erstelle eine `.env`-Datei im Hauptverzeichnis
   - Füge folgende Variablen hinzu:
     ```
     PORT=3000
     MONGODB_URI=mongodb://localhost:27017/listyouraigames
     ```

5. Server starten:

```
npm start
```

Die Website ist dann unter http://localhost:3000 erreichbar.

## Entwicklung

Für die Entwicklung kannst du den Server im Entwicklungsmodus starten:

```
npm run dev
```

Dies startet den Server mit Nodemon, sodass er bei Änderungen automatisch neu gestartet wird.

## Projektstruktur

```
listyouraigames.com/
├── models/             # MongoDB-Modelle
├── public/             # Statische Dateien
│   ├── css/            # CSS-Dateien
│   ├── js/             # JavaScript-Dateien
│   ├── images/         # Bilder
│   └── sounds/         # Sound-Effekte
├── views/              # EJS-Templates
├── .env                # Umgebungsvariablen
├── .gitignore          # Git-Ignore-Datei
├── app.js              # Hauptanwendungsdatei
├── package.json        # Projektabhängigkeiten
└── README.md           # Projektdokumentation
```

## Lizenz

MIT
