import React, { useEffect, useRef, useState } from "react";

const HUME_API_KEY = "tp79Q0ZBzRmtv3kBpdweoRpRVDIEggwBdHX7TNxZrOA1QWQA";
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
    if (!humeSocket || humeSocket.readyState !== WebSocket.OPEN) {
      connectToHume();
    }
  }, [humeSocket]);
  const connectToHume = async () => {
    const socket = new WebSocket(`${HUME_API_URL}?apiKey=${HUME_API_KEY}`);

    socket.onopen = () => {
      console.log("Connected to Hume AI WebSocket");
      setHumeSocket(socket);

      // // Example initial message configuration (modify as per your needs)
      // const initialMessage = {
      //   data: "",
      //   models: {
      //     prosody: {}, // Sending an empty configuration for prosody
      //   },
      // };

      // socket.send(JSON.stringify(initialMessage));
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

  const arrayBufferToBase64 = (buffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };
  const handlePrediction = (prediction) => {
    // Handle prediction data as needed, e.g., update state, UI, etc.
    // For example:
    setVideoDetails(prediction);
  };
  console.log({ humeSocket });

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

        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (
            event.data &&
            event.data.size > 0 &&
            humeSocket &&
            humeSocket.readyState === WebSocket.OPEN
          ) {
            const reader = new FileReader();
            reader.onloadend = () => {
              // const base64String = btoa(
              //   new Uint8Array(reader.result).reduce(
              //     (data, byte) => data + String.fromCharCode(byte),
              //     ""
              //   )
              // );
              console.log({ reader });
              // const base64String = arrayBufferToBase64(reader.result);
              const arrayBuffer = reader.result;
              const uint8Array = new Uint8Array(arrayBuffer);
              const base64String = btoa(
                String.fromCharCode.apply(null, uint8Array)
              );

              const chunk = {
                data: reader.result, // Ensure data is a valid string
                models: {
                  face: {
                    fps_pred: 3,
                    prob_threshold: 0.5,
                    identify_faces: true,
                    min_face_size: 20,
                    descriptions: {}, // Add any required fields for face model
                    facs: {}, // Add any required fields for facs model
                  },
                  prosody: {}, // Add your model configurations here
                },
              };
              humeSocket.send(JSON.stringify(chunk));
            };
            reader.readAsArrayBuffer(event.data);
          }
        };

        mediaRecorderRef.current.start(100); // Send data every 100ms
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
