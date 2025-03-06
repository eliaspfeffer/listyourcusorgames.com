import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Import the Chat model
const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model("ChatMessage", require("../models/Chat"));

const ioHandler = async (req, res) => {
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
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          dbName: "test",
        });
        console.log("MongoDB connected successfully!");
      }
    } catch (err) {
      console.error("MongoDB connection error:", err);
      return res.status(500).json({ error: "Database connection failed" });
    }

    io.on("connection", (socket) => {
      console.log("New socket connection:", socket.id);
      let currentUsername = "Anonym";

      socket.on("join game", async (gameId) => {
        if (!gameId) {
          console.error("No gameId provided for join event");
          return;
        }

        try {
          socket.join(gameId);
          console.log(`Socket ${socket.id} joined game: ${gameId}`);

          const messages = await ChatMessage.find({ gameId })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();

          console.log(`Found ${messages.length} messages for game ${gameId}`);
          socket.emit("previous messages", messages.reverse());
        } catch (err) {
          console.error("Error loading messages:", err);
          socket.emit("error", "Failed to load messages");
        }
      });

      socket.on("set username", (username) => {
        if (typeof username === "string" && username.trim()) {
          currentUsername = username.trim();
          console.log(
            `Username set for socket ${socket.id}: ${currentUsername}`
          );
        }
      });

      socket.on("chat message", async ({ gameId, msg }) => {
        console.log("Received chat message:", {
          gameId,
          msg,
          username: currentUsername,
        });

        if (!gameId || !msg || typeof msg !== "string") {
          console.error("Invalid message data received");
          return;
        }

        try {
          const message = new ChatMessage({
            username: currentUsername,
            text: msg.trim(),
            gameId: gameId,
            timestamp: new Date(),
          });

          console.log("Attempting to save message:", message);
          const savedMessage = await message.save();
          console.log("Message saved successfully:", savedMessage);

          io.to(gameId).emit("chat message", {
            username: savedMessage.username,
            text: savedMessage.text,
            timestamp: savedMessage.timestamp,
          });
        } catch (err) {
          console.error("Error saving message:", err);
          socket.emit("error", "Failed to send message");
        }
      });

      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });

    res.socket.server.io = io;
  }

  res.end();
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default ioHandler;
