// src/app/api/chat/route.ts
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Types ----
type ToolCall = { id: string; function: { name: string; arguments?: string } };

type SubmitOutput = { tool_call_id: string; output: string };

type ChatRequestBody = {
  threadId: string;
  assistantId: string;
  message?: string;
};

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
};

type TavilyResponse = {
  results?: TavilyResult[];
};

// ---- Route ----
export async function POST(req: NextRequest) {
  try {
    const { threadId, assistantId, message } = (await req.json()) as ChatRequestBody;

    if (!threadId || !assistantId) {
      return NextResponse.json(
        { error: "threadId and assistantId are required" },
        { status: 400 }
      );
    }

    if (typeof message === "string" && message.trim().length > 0) {
      await client.beta.threads.messages.create(threadId, {
        role: "user",
        content: message.trim(),
      });
    }

    let run = await client.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    while (!["completed", "failed", "cancelled", "expired"].includes(run.status)) {
      if (run.status === "requires_action") {
        const toolCalls: ToolCall[] =
          (run.required_action?.submit_tool_outputs?.tool_calls as ToolCall[]) ?? [];

        // Produce outputs for ALL tool calls in this batch
        const tool_outputs: SubmitOutput[] = await Promise.all(
          toolCalls.map(async (tc) => {
            const tool_call_id = tc.id;
            const fn = tc.function;
            const args = safeParse(fn.arguments);

            if (fn.name === "web_search") {
              const out = await doWebSearch({
                query: toNonEmptyString(args.query) ?? "",
                max_results: toBoundedInt(args.max_results, 3, 1, 10),
                include_domains: toStringArray(args.include_domains),
              });
              return { tool_call_id, output: JSON.stringify(out) };
            }

            // Defensive default for unknown tools
            return {
              tool_call_id,
              output: JSON.stringify({ error: `Unknown tool: ${fn.name}` }),
            };
          })
        );

        // Your SDK version expects thread_id in params
        run = await client.beta.threads.runs.submitToolOutputs(run.id, {
          thread_id: threadId,
          tool_outputs,
        });
      } else {
        await sleep(700);
        run = await client.beta.threads.runs.retrieve(run.id, { thread_id: threadId });
      }
    }

    const messages = await client.beta.threads.messages.list(threadId, { limit: 20 });
    return NextResponse.json({ status: run.status, messages: messages.data });
  } catch (err: unknown) {
    // Extract API error details without using 'any'
    const apiData =
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      typeof (err as { response?: { data?: unknown } }).response?.data !== "undefined"
        ? (err as { response?: { data?: unknown } }).response?.data
        : undefined;

    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: apiData ?? message }, { status: 400 });
  }
}

// ---- Helpers ----
function safeParse(s: string | undefined): Record<string, unknown> {
  try {
    return s ? (JSON.parse(s) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toNonEmptyString(v: unknown): string | undefined {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  }
  return undefined;
}

function toBoundedInt(
  v: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = typeof v === "number" ? Math.trunc(v) : Number.NaN;
  if (Number.isFinite(n)) {
    return Math.min(Math.max(n, min), max);
  }
  return Math.min(Math.max(fallback, min), max);
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Minimal EY-first web search used by the tool handler.
 * Option B: Direct Tavily call here for simplicity (no extra proxy needed).
 */
async function doWebSearch(args: {
  query: string;
  max_results: number;
  include_domains: string[];
}) {
  const query = args.query.trim();
  if (query.length === 0) return { error: "Missing query" };

  const max_results = toBoundedInt(args.max_results, 3, 1, 10);
  const include_domains =
    args.include_domains.length > 0 ? args.include_domains : ["ey.com"];

  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  if (!TAVILY_API_KEY) return { error: "Tavily API key not configured" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    signal: controller.signal,
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
  }).catch((e) => {
    clearTimeout(timeout);
    throw e;
  });

  clearTimeout(timeout);

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { error: `Tavily error: ${r.status} ${text}` };
  }

  const data = (await r.json()) as TavilyResponse;
  const list: TavilyResult[] = Array.isArray(data.results) ? data.results : [];

  return {
    query,
    include_domains,
    count: list.length,
    results: list.slice(0, max_results).map((x) => ({
      title: x.title ?? "",
      url: x.url ?? "",
      snippet: x.content ?? x.snippet ?? "",
    })),
  };
}
