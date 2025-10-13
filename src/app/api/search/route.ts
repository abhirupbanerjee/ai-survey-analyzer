// app/api/tools/web_search/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    if (req.method !== "POST") {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const query: string = body?.query;
    const max_results: number = Math.min(Math.max(Number(body?.max_results ?? 3), 1), 10);
    const include_domains: string[] =
      Array.isArray(body?.include_domains) && body.include_domains.length > 0
        ? body.include_domains
        : ["ey.com"]; // EY-first by default

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_API_KEY) {
      return NextResponse.json({ error: "Tavily API key not configured" }, { status: 500 });
    }

    // Call Tavily
    const resp = await fetch("https://api.tavily.com/search", {
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

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `Tavily error: ${resp.status} ${text}` },
        { status: 502 }
      );
    }

    const data = await resp.json();

    const results = Array.isArray(data?.results) ? data.results : [];
    const formatted = {
      query,
      include_domains,
      count: results.length,
      results: results.slice(0, max_results).map((r: any) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        snippet: r.content ?? r.snippet ?? "",
      })),
    };

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error("Tavily search error:", err);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
