import { io } from "socket.io-client";

// Automatically uses deployed server URL when available
const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000");

socket.on("connect", () => {
  console.log("✅ Connected to socket.io:", socket.id);
});

export default socket;
