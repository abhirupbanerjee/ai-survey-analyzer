// src/app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Types
type SearchBody = {
  query?: string;
  max_results?: number;
  include_domains?: string[];
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as SearchBody;

    const queryRaw = typeof body.query === "string" ? body.query : "";
    const query = queryRaw.trim();
    if (query.length === 0) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const max_results = boundInt(body.max_results ?? 3, 1, 10);

    const include_domains =
      Array.isArray(body.include_domains) && body.include_domains.length > 0
        ? body.include_domains.filter((d) => typeof d === "string").map((d) => d.trim()).filter(Boolean)
        : ["ey.com"]; // EY-first default

    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_API_KEY) {
      return NextResponse.json(
        { error: "Tavily API key not configured" },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch("https://api.tavily.com/search", {
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

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `Tavily error: ${resp.status} ${text}` },
        { status: 502 }
      );
    }

    const data = (await resp.json()) as TavilyResponse;
    const results: TavilyResult[] = Array.isArray(data?.results) ? data.results : [];

    const formatted = {
      query,
      include_domains,
      count: results.length,
      results: results.slice(0, max_results).map((r) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        snippet: r.content ?? r.snippet ?? "",
      })),
    };

    return NextResponse.json(formatted);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function boundInt(n: number, min: number, max: number): number {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.min(Math.max(v, min), max);
}
