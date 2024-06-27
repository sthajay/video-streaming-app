import React, { useRef, useState, useEffect } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3001");

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

  useEffect(() => {
    socket.on("chunkProcessed", (details) => {
      console.log("Processed chunk size:", details.size);
      setVideoDetails(details);
    });
  }, []);

  const startRecording = async () => {
    try {
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
        if (event.data.size > 0) {
          // Convert Blob to ArrayBuffer
          const reader = new FileReader();
          reader.onloadend = () => {
            socket.emit("videoChunk", reader.result);
          };
          reader.readAsArrayBuffer(event.data);

          if (event.data.type.includes("video")) {
            videoChunksRef.current.push(event.data);
          } else if (event.data.type.includes("audio")) {
            audioChunksRef.current.push(event.data); // Store audio chunks
          }
        }
      };
      mediaRecorderRef.current.start(100); // Send data every 100ms
      setRecording(true);
    } catch (error) {
      console.error("Error accessing media devices:", error);
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
      setRecordedAudioBlob(audioBlob); // Set recorded audio blob

      // Display recorded video for preview
      const videoUrl = URL.createObjectURL(videoBlob);
      if (previewVideoRef.current) {
        previewVideoRef.current.src = videoUrl;
        previewVideoRef.current.play(); // Autoplay for immediate playback
      }

      // Display recorded audio for preview (optional)
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

  const submitVideo = () => {
    // Example of how to handle uploading recorded video to server
    if (recordedVideoBlob) {
      const formData = new FormData();
      formData.append("video", recordedVideoBlob, "recording.webm");

      fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          console.log("Video details:", data);
          setVideoDetails(data);
        })
        .catch((error) => {
          console.error("Error uploading video:", error);
          // Handle error (e.g., show user a message)
        });
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
        <button onClick={submitVideo} disabled={!recordedVideoBlob}>
          Submit Video
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
          <audio ref={previewAudioRef} controls /> {/* Added audio preview */}
        </div>
      )}
      {videoDetails && (
        <div>
          <h3>Video Chunk Processed:</h3>
          <p>Chunk Size: {videoDetails.size} bytes</p>
          {/* <p>
            File:{" "}
            <a
              href={`/${videoDetails.filename}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download
            </a>
          </p> */}
        </div>
      )}
    </div>
  );
};

export default VideoRecorder;
