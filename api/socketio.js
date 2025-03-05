import { Server } from "socket.io";

const ioHandler = (req, res) => {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server);
    res.socket.server.io = io;

    // Chat-Nachrichten im Speicher
    const chatMessages = [];
    const MAX_MESSAGES = 50;

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
  res.end();
};

export default ioHandler;
