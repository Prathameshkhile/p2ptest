const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Allow CORS for client hosted elsewhere
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

app.get("/", (req, res) => {
  res.send("🔌 Socket.io server is live");
});

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("join", (roomId) => {
    console.log(`👥 ${socket.id} joined room: ${roomId}`);
    const room = io.sockets.adapter.rooms.get(roomId);
    const numberOfClients = room ? room.size : 0;

    socket.join(roomId);

    if (numberOfClients > 0) {
      socket.to(roomId).emit("other-user");
    }
  });

  socket.on("offer", ({ offer, roomId }) => {
    socket.to(roomId).emit("offer", { offer });
  });

  socket.on("answer", ({ answer, roomId }) => {
    socket.to(roomId).emit("answer", { answer });
  });

  socket.on("ice-candidate", ({ candidate, roomId }) => {
    socket.to(roomId).emit("ice-candidate", { candidate });
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Socket.io server running at http://localhost:${PORT}`);
});
