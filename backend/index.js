const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const WebSocket = require("ws");

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

async function connectToHume() {
  return new Promise((resolve, reject) => {
    const humeSocket = new WebSocket("wss://api.hume.ai/v0/stream/models", {
      headers: {
        "X-Hume-Api-Key": HUME_API_KEY,
      },
    });

    humeSocket.on("open", () => {
      console.log("Connected to Hume AI WebSocket");

      // Send initial configuration message without face model
      const initialMessage = {
        data: "",
        models: {
          prosody: {}, // Sending an empty configuration for prosody
        },
      };

      humeSocket.send(JSON.stringify(initialMessage));
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

    socket.on("videoChunk", (chunk) => {
      if (humeSocket && humeSocket.readyState === WebSocket.OPEN) {
        const faceConfig = {
          fps_pred: 3,
          prob_threshold: 0.5,
          identify_faces: true,
          min_face_size: 20,
          descriptions: {},
          facs: {},
        };

        const prosodyConfig = {};

        const videoMessage = {
          models: {
            face: faceConfig,
            prosody: prosodyConfig,
          },
          data: chunk, // Include the video data here
        };

        humeSocket.send(JSON.stringify(videoMessage));
      }
    });

    humeSocket.on("message", (message) => {
      if (typeof message === "string") {
        try {
          const messageObject = JSON.parse(message);
          console.log("Received JSON message from Hume AI:", messageObject);
          socket.emit("feedback", messageObject);
        } catch (error) {
          console.error("Error parsing JSON message:", error);
        }
      } else if (message instanceof Buffer) {
        console.log(
          "Received binary message from Hume AI:",
          message.length,
          "bytes"
        );
        const messageUtf8 = message.toString("utf-8");
        try {
          const messageObject = JSON.parse(messageUtf8);
          console.log(
            "Parsed binary message to JSON from Hume AI:",
            messageObject
          );
          socket.emit("feedback", messageObject);
        } catch (error) {
          console.error("Error parsing binary message to JSON:", error);
          console.log({ messageUtf8 });
        }
      } else {
        console.warn("Unsupported message format:", typeof message);
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
