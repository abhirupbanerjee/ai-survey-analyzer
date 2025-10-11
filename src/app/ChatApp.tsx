"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import remarkGfm from "remark-gfm";

interface Message {
  role: string;
  content: string;
  timestamp?: string;
}

const ChatApp = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeRun, setActiveRun] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
    if (threadId) localStorage.setItem("threadId", threadId);
  }, [messages, threadId]);

  useEffect(() => {
    const saved = localStorage.getItem("chatHistory");
    const savedThread = localStorage.getItem("threadId");
    if (saved) setMessages(JSON.parse(saved));
    if (savedThread) setThreadId(savedThread);
  }, []);

  // Voice Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const res = await axios.post("/api/transcribe", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setInput(res.data.text);
      setLoading(false);
    } catch (err: any) {
      console.error("Transcription error:", err);
      alert("Transcription failed. Please try again.");
      setLoading(false);
    }
  };

  // Text-to-Speech Function
  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-speech not supported in this browser.");
    }
  };

  const sendMessage = async () => {
    if (activeRun || !input.trim()) return;

    setActiveRun(true);
    setLoading(true);

    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");

    try {
      const res = await axios.post("/api/chat", {
        input: userInput,
        threadId,
      });

      if (res.data.error) {
        throw new Error(res.data.error);
      }

      setThreadId(res.data.threadId);

      const assistantMessage = {
        role: "assistant",
        content: res.data.reply,
        timestamp: new Date().toLocaleString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Auto-speak if voice is enabled
      if (voiceEnabled) {
        speakText(res.data.reply);
      }
    } catch (err: any) {
      console.error("Error:", err.response?.data || err.message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err.response?.data?.error || err.message || "Unable to reach assistant."}`,
          timestamp: new Date().toLocaleString(),
        },
      ]);
    } finally {
      setTyping(false);
      setLoading(false);
      setActiveRun(false);
    }
  };

  const copyChatToClipboard = async () => {
    const chatText = messages
      .map((msg) => `${msg.timestamp} - ${msg.role === "user" ? "You" : "Grenada AI Assistant"}:\n${msg.content}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(chatText);
      alert("Chat copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy chat: ", err);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-center w-full p-4 bg-white shadow-md">
        <img src="/icon.png" alt="Icon" className="h-12 w-12 sm:h-16 sm:w-16" />
        <h2 className="text-xl sm:text-2xl font-bold ml-2">Grenada AI Assistant</h2>
      </header>

      {/* Chat Container */}
      <div className="flex-grow w-full max-w-4xl mx-auto flex flex-col p-4">
        <div
          ref={chatContainerRef}
          className="flex-grow overflow-y-auto border p-3 space-y-4 bg-white shadow rounded-lg h-[65vh] sm:h-[70vh]"
        >
          {messages.map((msg, index) => (
            <motion.div key={index}>
              <p className="font-bold mb-1">
                {msg.role === "user" ? "You" : "Grenada AI Assistant"}{" "}
                {msg.timestamp && (
                  <span className="text-xs text-gray-500">({msg.timestamp})</span>
                )}
              </p>
              <div
                className={`p-3 rounded-md ${
                  msg.role === "user"
                    ? "bg-gray-200 text-black"
                    : "bg-white text-black border"
                }`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ ...props }) => (
                      <h1 style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "1.75rem", fontWeight: "bold", margin: "1rem 0" }} {...props} />
                    ),
                    h2: ({ ...props }) => (
                      <h2 style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "1.5rem", fontWeight: "bold", margin: "1rem 0" }} {...props} />
                    ),
                    h3: ({ ...props }) => (
                      <h3 style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "1.25rem", fontWeight: "bold", margin: "1rem 0" }} {...props} />
                    ),
                    code: ({ ...props }) => (
                      <code style={{ fontFamily: "'Segoe UI', sans-serif", background: "#f3f4f6", padding: "0.2rem 0.4rem", borderRadius: "4px" }} {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p style={{ marginBottom: "0.75rem", lineHeight: "1.6", fontFamily: "'Segoe UI', sans-serif", fontSize: "16px" }} {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul style={{ listStyleType: "disc", paddingLeft: "1.5rem", marginBottom: "1rem" }} {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol style={{ listStyleType: "decimal", paddingLeft: "1.5rem", marginBottom: "1rem" }} {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li style={{ marginBottom: "0.4rem" }} {...props} />
                    ),
                    table: ({ node, ...props }) => (
                      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "1rem" }} {...props} />
                    ),
                    th: ({ node, ...props }) => (
                      <th style={{ border: "1px solid #ccc", background: "#f3f4f6", padding: "8px", textAlign: "left" }} {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }} {...props} />
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
                {msg.role === "assistant" && (
                  <button
                    className="mt-2 text-xs text-blue-600 hover:underline"
                    onClick={() => speakText(msg.content)}
                  >
                    🔊 Play Audio
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          {typing && (
            <div className="text-gray-500 italic text-center p-2">Assistant is typing...</div>
          )}
        </div>
      </div>

      {/* Input & Controls */}
      <div className="w-full max-w-4xl mx-auto p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            className={`p-3 rounded ${isRecording ? "bg-red-500" : "bg-green-500"} text-white`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading}
          >
            {isRecording ? "⏹ Stop" : "🎤 Record"}
          </button>
          <input
            className="border rounded p-3 flex-grow"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type or record a message..."
          />
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded"
            onClick={sendMessage}
            disabled={loading}
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            className={`p-3 rounded flex-1 ${voiceEnabled ? "bg-green-500" : "bg-gray-400"} text-white`}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
          >
            {voiceEnabled ? "🔊 Voice On" : "🔇 Voice Off"}
          </button>
          <button
            className="bg-yellow-500 hover:bg-yellow-600 text-white p-3 rounded flex-1"
            onClick={copyChatToClipboard}
          >
            Copy Chat
          </button>
          <button
            className="bg-red-400 hover:bg-red-500 text-white p-3 rounded flex-1"
            onClick={() => {
              setMessages([]);
              setThreadId(null);
              localStorage.removeItem("threadId");
            }}
          >
            Clear Chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;