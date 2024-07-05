import React, { useEffect, useRef, useState } from "react";

const HUME_API_KEY = process.env.REACT_APP_HUME_API_KEY;
const HUME_API_URL = "wss://api.hume.ai/v0/stream/models";

const VideoRecorder = () => {
  const [recording, setRecording] = useState(false);
  const [videoDetails, setVideoDetails] = useState(null);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const videoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const previewAudioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const audioChunksRef = useRef([]);
  const [humeSocket, setHumeSocket] = useState(null);

  useEffect(() => {
    if (
      HUME_API_KEY ||
      !humeSocket ||
      humeSocket.readyState !== WebSocket.OPEN
    ) {
      connectToHume();
    }
  }, [humeSocket]);

  console.log({ HUME_API_KEY });

  const connectToHume = async () => {
    const socket = new WebSocket(`${HUME_API_URL}?apiKey=${HUME_API_KEY}`);

    socket.onopen = () => {
      console.log("Connected to Hume AI WebSocket");
      setHumeSocket(socket);
    };

    socket.onmessage = (event) => {
      try {
        console.log({ eventonmessage: JSON.parse(event.data) });
        const messageObject = JSON.parse(event.data);
        console.log("Received message from Hume AI:", messageObject);
        handlePrediction(messageObject);
      } catch (error) {
        console.error("Error parsing message from Hume AI:", error);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from Hume AI WebSocket");
      // setHumeSocket(null);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  };

  const handlePrediction = (prediction) => {
    // Handle prediction data as needed, e.g., update state, UI, etc.
    // For example:
    setVideoDetails(prediction);
  };
  console.log({ humeSocket });

  const arrayBufferToBase64 = (buffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const startRecording = async () => {
    try {
      // Ensure humeSocket is connected or connect to Hume AI WebSocket
      if (!humeSocket || humeSocket.readyState !== WebSocket.OPEN) {
        await connectToHume(); // Connect to Hume AI WebSocket if not already connected
      }
      if (humeSocket && humeSocket.readyState === WebSocket.OPEN) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        let chunks = [];

        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = () => {
          // Combine all recorded chunks into a single Blob
          const blob = new Blob(chunks, { type: "video/mp4" });

          // Convert Blob to Base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Data = reader.result;

            const chunk = {
              data: reader.result?.split("base64,")[1],
              job_details: true,
              models: {
                face: {
                  fps_pred: 3,
                  prob_threshold: 0.5,
                  identify_faces: true,
                  min_face_size: 20,
                  descriptions: {},
                  facs: {},
                },
                prosody: {},
              },
            };
            console.log({ chunk });
            console.log("sending hume data");
            humeSocket.send(JSON.stringify(chunk));
            chunks = [];
          };
          reader.readAsDataURL(blob);
        };

        mediaRecorderRef.current.start();
        // Process chunks every 5 seconds
        const interval = 5000; // 5 seconds
        const processingInterval = setInterval(() => {
          // Stop recording for this segment
          mediaRecorderRef.current.stop();

          // Restart recording for the next segment
          mediaRecorderRef.current.start();

          // Schedule the stop after 100ms (adjust as needed)
          // setTimeout(() => {
          //   mediaRecorderRef.current.stop();
          // }, 100);
        }, interval);

        setRecording(true);
      } else {
        console.error("humeSocket is not open or initialized.");
      }
    } catch (error) {
      console.error(
        "Error accessing media devices or connecting to WebSocket:",
        error
      );
      // Handle error (e.g., show user a message)
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
      setRecording(false);

      const videoBlob = new Blob(videoChunksRef.current, {
        type: "video/webm",
      });
      setRecordedVideoBlob(videoBlob);

      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });
      setRecordedAudioBlob(audioBlob);

      // Display recorded video for preview
      const videoUrl = URL.createObjectURL(videoBlob);
      if (previewVideoRef.current) {
        previewVideoRef.current.src = videoUrl;
        previewVideoRef.current.play(); // Autoplay for immediate playback
      }

      // Display recorded audio for preview
      const audioUrl = URL.createObjectURL(audioBlob);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = audioUrl;
        previewAudioRef.current.play(); // Autoplay for immediate playback
      }

      // Clear chunks
      videoChunksRef.current = [];
      audioChunksRef.current = [];
    }
  };

  return (
    <div>
      <video ref={videoRef} width="640" height="480" />
      <div>
        <button onClick={startRecording} disabled={recording}>
          Start Recording
        </button>
        <button onClick={stopRecording} disabled={!recording}>
          Stop Recording
        </button>
      </div>
      {recordedVideoBlob && (
        <div>
          <h3>Recorded Video:</h3>
          <video ref={previewVideoRef} width="640" height="480" controls />
        </div>
      )}
      {recordedAudioBlob && (
        <div>
          <h3>Recorded Audio:</h3>
          <audio ref={previewAudioRef} controls />
        </div>
      )}
      {videoDetails && (
        <div>
          <h3>Video Chunk Processed:</h3>
          <p>Chunk Size: {videoDetails.size} bytes</p>
        </div>
      )}
    </div>
  );
};

export default VideoRecorder;
