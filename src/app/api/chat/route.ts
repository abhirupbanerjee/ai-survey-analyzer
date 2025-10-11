import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

// ADD THIS FUNCTION before the export
function fixTableFormatting(text: string): string {
  const lines = text.split('\n');
  const processed: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect table rows (lines starting with |)
    if (line.startsWith('|') && line.endsWith('|')) {
      processed.push(line);
      
      // If this is the first table row, add separator
      if (i === 0 || !lines[i - 1].trim().startsWith('|')) {
        const cols = line.split('|').filter(c => c.trim()).length;
        const separator = '|' + ' --- |'.repeat(cols);
        processed.push(separator);
      }
    } else {
      processed.push(line);
    }
  }
  
  return processed.join('\n');
}


export async function POST(req: NextRequest) {
  
    try {
    // ✅ ADD AUTHENTICATION CHECK
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ VERIFY EMAIL WHITELIST
    const ALLOWED_EMAILS = [
      "mailabhirupbanerjee@gmail.com",
      // Remove mailabhirupbanerjee@gmail.com before production
    ];
    
    if (!ALLOWED_EMAILS.includes(session.user.email.toLowerCase())) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  
  
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
    const maxRetries = 25; // increase for complex code interpretor queries

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
      const messagesRes = await axios.get(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        { headers }
      );
      const assistantMsg = messagesRes.data.data.find((m: any) => m.role === "assistant");
      reply =
        assistantMsg?.content?.[0]?.text?.value?.replace(/【\d+:\d+†[^】]+】/g, "") ||
        "No valid response.";
    }
    // add this line to fix table formatting
    reply = fixTableFormatting(reply);

    return NextResponse.json({ reply, threadId: currentThreadId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.response?.data?.error?.message || err.message || "Unknown error" },
      { status: 500 }
    );
  }
}