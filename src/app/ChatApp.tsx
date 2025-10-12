"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import remarkGfm from "remark-gfm";
import Image from "next/image";

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
  const [isLoading, setIsLoading] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // ✅ IMPROVED LOAD LOGIC WITH RETRY
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const saved = localStorage.getItem("chatHistory");
        const savedThread = localStorage.getItem("threadId");
        
        console.log("📂 Loading from localStorage:", { 
          hasChatHistory: !!saved, 
          hasThreadId: !!savedThread 
        });
        
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
              console.log("✅ Loaded", parsed.length, "messages");
            }
          } catch (parseError) {
            console.error("❌ Failed to parse chat history:", parseError);
            localStorage.removeItem("chatHistory"); // Clean up corrupted data
          }
        }
        
        if (savedThread) {
          setThreadId(savedThread);
          console.log("✅ Loaded threadId:", savedThread);
        }
      } catch (error) {
        console.error("❌ Error accessing localStorage:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Immediate load
    loadFromStorage();
    
    // Retry after 100ms to handle race conditions
    const timer = setTimeout(loadFromStorage, 100);
    
    return () => clearTimeout(timer);
  }, []); // Empty deps - runs once on mount

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize textarea
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  // Reset textarea height when input is cleared
  useEffect(() => {
    if (input === '' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input]);

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
      
      // Auto-resize textarea after transcription
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
      }
      
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
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/^[\s]*[-*_]{3,}[\s]*$/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // Text-to-Speech Function
  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
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

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // ✅ IMPROVED SEND MESSAGE WITH IMMEDIATE SAVES
  const sendMessage = async () => {
    if (activeRun || !input.trim()) return;

    stopSpeaking();

    setActiveRun(true);
    setLoading(true);
    setTyping(true);

    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleString(),
    };
    
    // ✅ Update state AND save immediately (synchronous)
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    localStorage.setItem("chatHistory", JSON.stringify(newMessages));
    console.log("💾 Saved user message to localStorage");
    
    const userInput = input;
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await axios.post("/api/chat", {
        input: userInput,
        threadId,
      });

      if (res.data.error) {
        throw new Error(res.data.error);
      }

      const newThreadId = res.data.threadId;
      setThreadId(newThreadId);
      
      // ✅ Save threadId immediately
      localStorage.setItem("threadId", newThreadId);
      console.log("💾 Saved threadId to localStorage");

      const assistantMessage = {
        role: "assistant",
        content: res.data.reply,
        timestamp: new Date().toLocaleString(),
      };

      // ✅ Update with assistant message AND save
      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      localStorage.setItem("chatHistory", JSON.stringify(finalMessages));
      console.log("💾 Saved assistant message to localStorage");

      if (voiceEnabled) {
        speakText(res.data.reply);
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      console.error("Error:", error.response?.data || error.message);
      
      const errorMessage = {
        role: "assistant",
        content: `Error: ${error.response?.data?.error || error.message || "Unable to reach assistant."}`,
        timestamp: new Date().toLocaleString(),
      };
      
      // ✅ Save error state too
      const errorMessages = [...newMessages, errorMessage];
      setMessages(errorMessages);
      localStorage.setItem("chatHistory", JSON.stringify(errorMessages));
      console.log("💾 Saved error message to localStorage");
      
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
      <header className="relative flex items-center justify-center w-full p-3 sm:p-4 bg-white shadow-md">
        <div className="flex items-center">
          <Image 
            src="/icon.png" 
            alt="Icon" 
            width={64}
            height={64}
            className="h-10 w-10 sm:h-16 sm:w-16" 
          />
          <h2 className="text-sm sm:text-2xl font-bold ml-2">Caribbean AI Survey Assistant</h2>
        </div>
        {/* Sign out button - Icon on mobile, text on desktop */}
        <button
          onClick={() => window.location.href = '/api/auth/signout'}
          className="absolute right-3 sm:right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Sign out"
        >
          <span className="sm:hidden">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </span>
          <span className="hidden sm:inline text-gray-700 font-medium">Sign out</span>
        </button>
      </header>

      {/* Chat Container */}
      <div className="flex-grow w-full max-w-4xl mx-auto flex flex-col p-3 sm:p-4">
        <div
          ref={chatContainerRef}
          className="flex-grow overflow-y-auto border p-3 space-y-4 bg-white shadow rounded-lg h-[65vh] sm:h-[70vh]"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-6 max-w-2xl leading-relaxed">
                <p className="mb-3">
                  This survey was conducted to capture the voices of Caribbean public and private sector leaders on artificial intelligence. Too often, global surveys overlook or dilute Caribbean perspectives.
                  This initiative aims to change that — making sure our region&apos;s priorities, concerns, and aspirations are heard. The insights here represent what could become the landmark survey on AI for Caribbean leaders.
                </p>
                <p className="font-semibold text-gray-700 mb-4">Explore the findings below:</p>
              </div>
              
              <h4 className="text-sm sm:text-base font-semibold text-gray-700 mb-3">Suggested Prompts</h4>
              <div className="flex flex-col gap-3 w-full max-w-2xl">
                <button
                  onClick={() => setInput("What are the top survey findings overall?")}
                  className="p-3 sm:p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-left text-xs sm:text-sm transition-colors"
                >
                  <div className="font-semibold mb-1">📊 What are the top survey findings overall?</div>
                  <div className="text-gray-600 text-xs">
                    See the most important themes and priorities emerging across all leaders.
                  </div>
                </button>
                <button
                  onClick={() => setInput("What are the biggest risks and concerns leaders see with AI?")}
                  className="p-3 sm:p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-left text-xs sm:text-sm transition-colors"
                >
                  <div className="font-semibold mb-1">⚠️ What are the biggest risks and concerns leaders see with AI?</div>
                  <div className="text-gray-600 text-xs">
                    Understand the challenges, risks, and areas of caution highlighted in the survey.
                  </div>
                </button>
                <button
                  onClick={() => setInput("How do views differ by sector, country, or leadership role (CEO, CHRO, CTO, etc.)?")}
                  className="p-3 sm:p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-left text-xs sm:text-sm transition-colors"
                >
                  <div className="font-semibold mb-1">🌍 How do views differ by sector, country, or leadership role?</div>
                  <div className="text-gray-600 text-xs">
                    Explore differences in perspectives across industries, regions, and leadership positions.
                  </div>
                </button>
              </div>
            </div>
          ) : null}
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
              AI Assistant is thinking<span className="inline-block animate-pulse">...</span>
            </div>
          )}
        </div>
      </div>

      {/* Stop Speaking Button */}
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
        <div className="flex items-end gap-2 bg-white border rounded-lg p-2 shadow-sm">
          <textarea
            ref={textareaRef}
            className="flex-grow p-2 outline-none resize-none overflow-y-auto"
            style={{ minHeight: '40px', maxHeight: '120px' }}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type or record a message..."
            rows={1}
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
            className={`flex-1 p-3 rounded-lg transition-all text-sm sm:text-base ${
              voiceEnabled 
                ? "bg-white border-2 border-green-500 text-green-600 font-medium" 
                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            }`}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title="Toggle auto-play voice responses"
          >
            <span className="hidden sm:inline">{voiceEnabled ? "🔊 Voice" : "🔇 Voice"}</span>
            <span className="sm:hidden text-xl">{voiceEnabled ? "🔊" : "🔇"}</span>
          </button>
          <button
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-lg transition-colors text-sm sm:text-base"
            onClick={copyChatToClipboard}
            title="Copy chat to clipboard"
          >
            <span className="hidden sm:inline">📋 Copy</span>
            <span className="sm:hidden text-xl">📋</span>
          </button>
          <button
            className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 p-3 rounded-lg transition-colors text-sm sm:text-base"
            onClick={() => {
              setMessages([]);
              setThreadId(null);
              localStorage.removeItem("chatHistory");
              localStorage.removeItem("threadId");
              console.log("🗑️ Cleared chat history and localStorage");
            }}
            title="Clear chat history"
          >
            <span className="hidden sm:inline">🗑️ Clear</span>
            <span className="sm:hidden text-xl">🗑️</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;