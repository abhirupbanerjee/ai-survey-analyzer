"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import ChatApp from "./ChatApp"; // Move your chat component to ChatApp.tsx

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl mb-4">Welcome to  AI survey assistant</h1>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => signIn()}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        className="absolute top-4 right-4 px-3 py-1 bg-gray-200 rounded"
        onClick={() => signOut()}
      >
        Sign out
      </button>
      <ChatApp />
    </div>
  );
}