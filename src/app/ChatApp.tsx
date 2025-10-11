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
  const [isSpeaking, setIsSpeaking] = useState(false);
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
    } catch (err) {
      const error = err as Error;
      console.error("Transcription error:", error);
      alert("Transcription failed. Please try again.");
      setLoading(false);
    }
  };

  // Strip markdown syntax for clean speech
  const stripMarkdown = (text: string): string => {
    return text
      // Remove headers (### Header)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold (**text** or __text__)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      // Remove italic (*text* or _text_)
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      // Remove strikethrough (~~text~~)
      .replace(/~~(.+?)~~/g, '$1')
      // Remove code blocks (```code```)
      .replace(/```[\s\S]*?```/g, 'code block')
      // Remove inline code (`code`)
      .replace(/`(.+?)`/g, '$1')
      // Remove links [text](url)
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Remove images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1')
      // Remove bullet points
      .replace(/^\s*[-*+]\s+/gm, '')
      // Remove numbered lists
      .replace(/^\s*\d+\.\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[\s]*[-*_]{3,}[\s]*$/gm, '')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // Text-to-Speech Function
  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const cleanText = stripMarkdown(text);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-speech not supported in this browser.");
    }
  };

  // Stop speech function
  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const sendMessage = async () => {
    if (activeRun || !input.trim()) return;

    // Stop any ongoing speech when sending new message
    stopSpeaking();

    setActiveRun(true);
    setLoading(true);
    setTyping(true);

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
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      console.error("Error:", error.response?.data || error.message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.response?.data?.error || error.message || "Unable to reach assistant."}`,
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
      .map((msg) => `${msg.timestamp} - ${msg.role === "user" ? "You" : "Caribbean AI Survey Assistant"}:\n${msg.content}`)
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
        <h2 className="text-xl sm:text-2xl font-bold ml-2">Caribbean AI Survey Assistant</h2>
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
                {msg.role === "user" ? "You" : "Caribbean AI Survey Assistant"}{" "}
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
                    p: ({ ...props }) => (
                      <p style={{ marginBottom: "0.75rem", lineHeight: "1.6", fontFamily: "'Segoe UI', sans-serif", fontSize: "16px" }} {...props} />
                    ),
                    ul: ({ ...props }) => (
                      <ul style={{ listStyleType: "disc", paddingLeft: "1.5rem", marginBottom: "1rem" }} {...props} />
                    ),
                    ol: ({ ...props }) => (
                      <ol style={{ listStyleType: "decimal", paddingLeft: "1.5rem", marginBottom: "1rem" }} {...props} />
                    ),
                    li: ({ ...props }) => (
                      <li style={{ marginBottom: "0.4rem" }} {...props} />
                    ),
                    table: ({ ...props }) => (
                      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "1rem" }} {...props} />
                    ),
                    th: ({ ...props }) => (
                      <th style={{ border: "1px solid #ccc", background: "#f3f4f6", padding: "8px", textAlign: "left" }} {...props} />
                    ),
                    td: ({ ...props }) => (
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
            <div className="text-gray-500 italic p-2">
              Assistant is thinking<span className="inline-block animate-pulse">...</span>
            </div>
          )}
        </div>
      </div>

      {/* Stop Speaking Button (appears when speaking) */}
      {isSpeaking && (
        <div className="w-full max-w-4xl mx-auto px-4">
          <button
            className="w-full bg-red-500 hover:bg-red-600 text-white p-2 rounded mb-2"
            onClick={stopSpeaking}
          >
            ⏹ Stop Speaking
          </button>
        </div>
      )}

      {/* Input & Controls */}
      <div className="w-full max-w-4xl mx-auto p-4 flex flex-col gap-3">
        {/* Main Input Row */}
        <div className="flex items-center gap-2 bg-white border rounded-lg p-2 shadow-sm">
          <input
            className="flex-grow p-2 outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type or record a message..."
          />
          <button
            className={`p-3 rounded-full transition-colors ${
              isRecording 
                ? "bg-red-500 hover:bg-red-600 text-white" 
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading}
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? "⏹" : "🎤"}
          </button>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            onClick={sendMessage}
            disabled={loading}
            title="Send message (Enter)"
          >
            {loading ? "..." : "➤"}
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="flex gap-2">
          <button
            className={`flex-1 p-3 rounded-lg transition-all ${
              voiceEnabled 
                ? "bg-white border-2 border-green-500 text-green-600 font-medium" 
                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            }`}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title="Toggle auto-play voice responses"
          >
            {voiceEnabled ? "🔊 Voice" : "🔇 Voice"}
          </button>
          <button
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-lg transition-colors"
            onClick={copyChatToClipboard}
            title="Copy chat to clipboard"
          >
            📋 Copy
          </button>
          <button
            className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 p-3 rounded-lg transition-colors"
            onClick={() => {
              setMessages([]);
              setThreadId(null);
              localStorage.removeItem("threadId");
            }}
            title="Clear chat history"
          >
            🗑️ Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;