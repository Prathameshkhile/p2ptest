const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow any origin for dev (you can restrict later)
    methods: ["GET", "POST"],
  },
});

app.use(cors());

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("join", (roomId) => {
    console.log(`👥 ${socket.id} joined room: ${roomId}`);
    const room = io.sockets.adapter.rooms.get(roomId);
    const numberOfClients = room ? room.size : 0;

    socket.join(roomId);

    if (numberOfClients > 0) {
      console.log("🔁 Sending 'other-user' to:", socket.id);
      socket.to(roomId).emit("other-user");
    }
  });

  socket.on("offer", ({ offer, roomId }) => {
    console.log("📨 Offer received from:", socket.id);
    socket.to(roomId).emit("offer", { offer });
  });

  socket.on("answer", ({ answer, roomId }) => {
    console.log("📨 Answer received from:", socket.id);
    socket.to(roomId).emit("answer", { answer });
  });

  socket.on("ice-candidate", ({ candidate, roomId }) => {
    console.log("📡 ICE candidate from:", socket.id);
    socket.to(roomId).emit("ice-candidate", { candidate });
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

server.listen(5000, () => {
  console.log("🚀 Socket.io server listening on http://localhost:5000");
});
