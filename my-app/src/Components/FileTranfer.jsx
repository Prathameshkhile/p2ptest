import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://p2ptest-f04t.onrender.com"); // your backend URL

const FileTransfer = () => {
  const [roomId, setRoomId] = useState("");
  const [file, setFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [receivedFileName, setReceivedFileName] = useState("");
  const [receivedFileType, setReceivedFileType] = useState("");

  const peerRef = useRef(null);
  const dataChannelRef = useRef(null);
  const receivedChunksRef = useRef([]);

  // ✅ TURN + STUN for cross-network
  const iceConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:relay1.expressturn.com:3478",
        username: "efk4k57ZzYVZ9WD5bq6kJz9zvZ5Z2g2f",
        credential: "5V9XEdYbyN3jZyZd",
      },
    ],
  };

  const createPeer = (initiator) => {
    peerRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: "efk4k57ZzYVZ9WD5bq6kJz9zvZ5Z2g2f",
          credential: "5V9XEdYbyN3jZyZd",
        },
      ],
      iceTransportPolicy: "relay", // or "relay" to force TURN only for stricter networks
    });

    // ✅ ICE candidate handler
    peerRef.current.onicecandidate = (e) => {
      if (e.candidate) {
        console.log("🔁 Sending ICE candidate");
        socket.emit("ice-candidate", {
          candidate: e.candidate,
          roomId,
        });
      }
    };

    // ✅ ICE gathering state (debugging)
    peerRef.current.onicegatheringstatechange = () => {
      console.log("ICE Gathering State:", peerRef.current.iceGatheringState);
    };

    // ✅ Connection state
    peerRef.current.onconnectionstatechange = () => {
      console.log("📡 Connection state:", peerRef.current.connectionState);

      if (peerRef.current.connectionState === "failed") {
        console.warn("🚫 Connection failed.");
        // optionally retry or alert user
      } else if (peerRef.current.connectionState === "connected") {
        console.log("✅ Peer connected!");
      }
    };

    // ✅ Setup data channel
    if (initiator) {
      console.log("📦 Creating data channel...");
      dataChannelRef.current = peerRef.current.createDataChannel("file");
      setupDataChannel();
    } else {
      peerRef.current.ondatachannel = (event) => {
        console.log("📩 Data channel received");
        dataChannelRef.current = event.channel;
        setupDataChannel();
      };
    }
  };

  const setupDataChannel = () => {
    dataChannelRef.current.binaryType = "arraybuffer";

    dataChannelRef.current.onmessage = (e) => {
      if (typeof e.data === "string") {
        if (e.data.startsWith("fileinfo::")) {
          const [_, name, type] = e.data.split("::");
          setReceivedFileName(name);
          setReceivedFileType(type);
          receivedChunksRef.current = [];
        } else if (e.data === "done") {
          const blob = new Blob(receivedChunksRef.current, {
            type: receivedFileType || "application/octet-stream",
          });
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
        }
      } else {
        receivedChunksRef.current.push(e.data);
      }
    };
  };

  const sendFile = () => {
    if (
      !file ||
      !dataChannelRef.current ||
      dataChannelRef.current.readyState !== "open"
    )
      return;

    const chunkSize = 16 * 1024;
    const reader = new FileReader();
    let offset = 0;

    reader.onload = (e) => {
      if (e.target.result) {
        dataChannelRef.current.send(e.target.result);
        offset += e.target.result.byteLength;

        if (offset < file.size) {
          readSlice(offset);
        } else {
          dataChannelRef.current.send("done");
        }
      }
    };

    const readSlice = (o) => {
      const slice = file.slice(o, o + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    dataChannelRef.current.send(`fileinfo::${file.name}::${file.type}`);
    readSlice(0);
  };

  const handleJoin = async () => {
    console.log("Joining room:", roomId);
    createPeer(true);
    socket.emit("join", roomId);
  };

  useEffect(() => {
    socket.on("connect", () => {
      console.log("✅ Connected to server", socket.id);
    });

    socket.on("other-user", async () => {
      console.log("Other user joined, creating offer...");
      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      socket.emit("offer", { offer, roomId });
    });

    socket.on("offer", async ({ offer }) => {
      console.log("Received offer");
      createPeer(false);
      await peerRef.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socket.emit("answer", { answer, roomId });
    });

    socket.on("answer", async ({ answer }) => {
      console.log("Received answer");
      await peerRef.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("Added ICE candidate");
      } catch (err) {
        console.error("Error adding received ICE candidate", err);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("other-user");
    };
  }, [roomId]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>🛰️ P2P File Transfer</h2>
      <input
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <button onClick={handleJoin}>Join Room</button>

      <hr />

      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={sendFile}>Send File</button>

      {downloadUrl && (
        <div>
          <p>✅ File received: {receivedFileName}</p>
          <a href={downloadUrl} download={receivedFileName}>
            Download File
          </a>
          {receivedFileType?.startsWith("image/") && (
            <img
              src={downloadUrl}
              alt="Preview"
              style={{ maxWidth: "300px", marginTop: "10px" }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default FileTransfer;
