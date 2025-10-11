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
  const [isLoaded, setIsLoaded] = useState(false); // NEW: Prevent race condition
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // LOAD from localStorage - runs ONCE on mount
  useEffect(() => {
    if (isLoaded) return; // Prevent re-running
    
    try {
      const saved = localStorage.getItem("chatHistory");
      const savedThread = localStorage.getItem("threadId");
      
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log("✅ Loaded messages:", parsed.length); // Debug
        setMessages(parsed);
      } else {
        console.log("ℹ️ No saved messages found");
      }
      
      if (savedThread) {
        console.log("✅ Loaded threadId:", savedThread); // Debug
        setThreadId(savedThread);
      } else {
        console.log("ℹ️ No saved thread found");
      }
    } catch (error) {
      console.error("❌ Error loading saved data:", error);
    }
    
    setIsLoaded(true);
  }, []); // Empty deps - runs once

  // SAVE to localStorage - runs AFTER initial load
  useEffect(() => {
    if (!isLoaded) return; // Don't save during initial load
    
    try {
      localStorage.setItem("chatHistory", JSON.stringify(messages));
      console.log("💾 Saved messages:", messages.length); // Debug
      
      if (threadId) {
        localStorage.setItem("threadId", threadId);
        console.log("💾 Saved threadId:", threadId); // Debug
      }
    } catch (error) {
      console.error("❌ Error saving data:", error);
    }
  }, [messages, threadId, isLoaded]);

  const sendMessage = async () => {
    if (activeRun || !input.trim()) return;

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

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.reply, timestamp: new Date().toLocaleString() },
      ]);
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: {
            error?: string;
          };
        };
        message?: string;
      };

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
      .map((msg) => `${msg.timestamp} - ${msg.role === "user" ? "You" : "AI Survey Assistant"}:\n${msg.content}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(chatText);
      alert("Chat copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy chat: ", err);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setThreadId(null);
    localStorage.removeItem("chatHistory");
    localStorage.removeItem("threadId");
    console.log("🗑️ Chat cleared"); // Debug
  };

  return (
    <div className="h-screen w-full flex flex-col bg-white">
      <header className="flex items-center justify-center w-full p-4 bg-white shadow-md">
        <Image src="/icon.png" alt="Icon" width={64} height={64} className="h-12 w-12 sm:h-16 sm:w-16" />
        <h2 className="text-xl sm:text-2xl font-bold ml-2">AI Survey Assistant</h2>
      </header>

      {/* Debug Panel - Remove after testing */}
      <div className="bg-gray-100 p-2 text-xs text-center text-gray-600">
        💬 Messages: {messages.length} | 🔗 Thread: {threadId ? "Active" : "None"} | 
        📁 Loaded: {isLoaded ? "Yes" : "No"}
      </div>

      <div className="flex-grow w-full max-w-4xl mx-auto flex flex-col p-4">
        <div
          ref={chatContainerRef}
          className="flex-grow overflow-y-auto border p-3 space-y-4 bg-white shadow rounded-lg h-[65vh] sm:h-[70vh]"
        >
          {messages.map((msg, index) => (
            <motion.div key={index}>
              <p className="font-bold mb-1">
                {msg.role === "user" ? "You" : "AI Survey Assistant"}{" "}
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
              </div>
            </motion.div>
          ))}
          {typing && (
            <div className="text-gray-500 italic text-center p-2">Assistant is typing...</div>
          )}
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto p-4 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <input
            className="border rounded p-3 w-full sm:w-4/5"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
          />
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded w-full sm:w-1/5"
            onClick={sendMessage}
            disabled={loading}
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            className="bg-yellow-500 hover:bg-yellow-600 text-white p-3 rounded w-full"
            onClick={copyChatToClipboard}
          >
            Copy Chat
          </button>
          <button
            className="bg-red-400 hover:bg-red-500 text-white p-3 rounded w-full"
            onClick={clearChat}
          >
            Clear Chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;