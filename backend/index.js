const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const axios = require("axios");
const WebSocket = require("ws");
const buffer = require("buffer");
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
const HUME_API_KEY = "tp79Q0ZBzRmtv3kBpdweoRpRVDIEggwBdHX7TNxZrOA1QWQA";

app.use(cors());
app.use(express.json());
app.use(express.static("uploads"));

// Function to connect to Hume AI WebSocket
async function connectToHume() {
  return new Promise((resolve, reject) => {
    const humeSocket = new WebSocket("wss://api.hume.ai/v0/stream/models", {
      headers: {
        "X-Hume-Api-Key": HUME_API_KEY,
      },
    });

    humeSocket.on("open", () => {
      console.log("Connected to Hume AI WebSocket");

      const initMessage = JSON.stringify({
        data: "",
        models: {
          face: {
            // landmarks: true,
            // attributes: true,
            // expressions: true,
          },
          prosody: {
            // intonation: true,
            // speechRate: true,
            // volume: true,
          },
        },
      });
      humeSocket.send(initMessage);

      resolve(humeSocket);
    });

    humeSocket.on("error", (error) => {
      console.error("Hume AI WebSocket Error:", error);
      reject(error);
    });
  });
}

io.on("connection", async (socket) => {
  console.log("Connecting Client ...");

  try {
    const humeSocket = await connectToHume();

    socket.on("videoStream", (data) => {
      console.log("Received video streamm");

      humeSocket.send(data);
    });

    socket.on("videoChunk", (chunk) => {
      humeSocket.send(chunk);
      console.log("Received video chunk");
      const buffer = Buffer.from(chunk);
      // console.log("Chunk size:", buffer.length);
      socket.emit("chunkProcessed", { size: buffer.length });
    });

    humeSocket.on("message", (message) => {
      const messageString = message.toString("utf-8");

      try {
        // Parse the string to a JSON object
        const messageObject = JSON.parse(messageString);
        console.log({ messageObject });

        // Emit the parsed object back to the frontend/client
        socket.emit("feedback", messageObject);
      } catch (error) {
        console.error("Error parsing message:", error);
        // Handle parsing error as needed
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
      humeSocket.close();
    });

    humeSocket.on("close", () => {
      console.log("Hume AI WebSocket disconnected");
    });
  } catch (error) {
    console.error("Error connecting to Hume AI WebSocket:", error);
  }
});

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

app.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }
  res.json({
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    filename: req.file.filename,
    path: req.file.path,
  });
});

// io.on("connection", (socket) => {
//   console.log("New client connected");

//   socket.on("videoChunk", (chunk) => {
//     console.log("Received video chunk");
//     const blob = new Blob([chunk], { type: "video/webm" });
//     console.log("Chunk size:", blob.size);
//     socket.emit("chunkProcessed", { size: blob.size });
//   });

//   socket.on("disconnect", () => {
//     console.log("Client disconnected");
//   });
// });

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
