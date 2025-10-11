import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

// Define types for OpenAI API responses
interface OpenAIMessage {
  role: string;
  content?: Array<{
    text?: {
      value?: string;
    };
  }>;
}

interface OpenAIMessagesResponse {
  data: {
    data: OpenAIMessage[];
  };
}

export async function POST(req: NextRequest) {
  try {
    const { input, threadId } = await req.json();

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;
    const OPENAI_ORGANIZATION = process.env.OPENAI_ORGANIZATION;

    if (!OPENAI_API_KEY || !ASSISTANT_ID) {
      return NextResponse.json({ error: "Missing OpenAI credentials" }, { status: 500 });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    };
    if (OPENAI_ORGANIZATION) {
      headers["OpenAI-Organization"] = OPENAI_ORGANIZATION;
    }

    let currentThreadId = threadId;
    if (!currentThreadId) {
      const threadRes = await axios.post(
        "https://api.openai.com/v1/threads",
        {},
        { headers }
      );
      currentThreadId = threadRes.data.id;
    }

    await axios.post(
      `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
      { role: "user", content: input },
      { headers }
    );

    const runRes = await axios.post(
      `https://api.openai.com/v1/threads/${currentThreadId}/runs`,
      { assistant_id: ASSISTANT_ID },
      { headers }
    );

    const runId = runRes.data.id;
    let status = "in_progress";
    let retries = 0;
    const maxRetries = 25;

    while ((status === "in_progress" || status === "queued") && retries < maxRetries) {
      await new Promise((res) => setTimeout(res, 3000));
      const statusRes = await axios.get(
        `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`,
        { headers }
      );
      status = statusRes.data.status;
      retries++;
    }

    let reply = "No response received.";
    if (status === "completed") {
      const messagesRes = await axios.get<OpenAIMessagesResponse["data"]>(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        { headers }
      );
      const assistantMsg = messagesRes.data.data.find((m: OpenAIMessage) => m.role === "assistant");
      reply =
        assistantMsg?.content?.[0]?.text?.value?.replace(/【\d+:\d+†[^】]+】/g, "") ||
        "No valid response.";
    }

    return NextResponse.json({ reply, threadId: currentThreadId });
  } catch (err: unknown) {
    const error = err as {
      response?: {
        data?: {
          error?: {
            message?: string;
          };
        };
      };
      message?: string;
    };
    
    return NextResponse.json(
      { error: error.response?.data?.error?.message || error.message || "Unknown error" },
      { status: 500 }
    );
  }
}