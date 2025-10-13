// app/api/chat/route.ts
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { threadId, assistantId, message } = await req.json();

    if (!threadId || !assistantId) {
      return NextResponse.json({ error: "threadId and assistantId are required" }, { status: 400 });
    }

    if (message && typeof message === "string") {
      await client.beta.threads.messages.create(threadId, {
        role: "user",
        content: message,
      });
    }

    let run = await client.beta.threads.runs.create(threadId, { assistant_id: assistantId });

    while (!["completed", "failed", "cancelled", "expired"].includes(run.status)) {
      if (run.status === "requires_action") {
        const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls ?? [];

        // ✅ Return outputs for **all** tool_call_ids in this batch
        const tool_outputs = await Promise.all(
          toolCalls.map(async (tc) => {
            const tool_call_id = tc.id;
            const fn = tc.function;
            const args = safeParse(fn.arguments);

            if (fn.name === "web_search") {
              const out = await doWebSearch(args); // EY-first inside
              return { tool_call_id, output: JSON.stringify(out) };
            }

            // Never leave a call unanswered
            return { tool_call_id, output: JSON.stringify({ error: `Unknown tool: ${fn.name}` }) };
          })
        );

        // submit tool outputs
        run = await client.beta.threads.runs.submitToolOutputs(run.id, {
          thread_id: threadId,
          tool_outputs, // [{ tool_call_id, output }]
        });
      } else {
        await sleep(1000);
        run = await client.beta.threads.runs.retrieve(run.id, {
          thread_id: threadId,
        });
      }
    }

    const messages = await client.beta.threads.messages.list(threadId, { limit: 20 });
    return NextResponse.json({ status: run.status, messages: messages.data });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: err?.response?.data ?? err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}

function safeParse(s: string | undefined) {
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Minimal EY-first search used by the tool handler */
async function doWebSearch(args: {
  query?: string;
  max_results?: number;
  include_domains?: string[];
}) {
  const query = (args?.query ?? "").trim();
  if (!query) return { error: "Missing query" };

  const max_results = Math.min(Math.max(Number(args?.max_results ?? 3), 1), 10);
  const include_domains =
    Array.isArray(args?.include_domains) && args!.include_domains!.length > 0
      ? args!.include_domains!
      : ["ey.com"];

  // Option A: call your internal proxy route (keeps API keys server-side)
  // const resp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/tools/web_search`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ query, max_results, include_domains }),
  // });
  // return await resp.json();

  // Option B: call Tavily directly
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  if (!TAVILY_API_KEY) return { error: "Tavily API key not configured" };

  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tavily-API-Key": TAVILY_API_KEY,
    },
    body: JSON.stringify({
      query,
      include_domains,
      max_results,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { error: `Tavily error: ${r.status} ${text}` };
  }

  const data = await r.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return {
    query,
    include_domains,
    count: results.length,
    results: results.slice(0, max_results).map((x: any) => ({
      title: x.title ?? "",
      url: x.url ?? "",
      snippet: x.content ?? x.snippet ?? "",
    })),
  };
}
