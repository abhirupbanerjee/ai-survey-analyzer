import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query, max_results = 3, include_domains = [] } = await req.json();
    // Allow flexible domain filtering - empty array means search all domains

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_API_KEY) {
      return NextResponse.json({ error: "Tavily API key not configured" }, { status: 500 });
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "basic",
        include_answer: true,
        include_images: false,
        include_raw_content: "text",
        max_results: max_results,
        include_domains: include_domains,
        exclude_domains: []
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.detail || "Tavily search failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Format the response for better readability
    const formattedResults = {
      answer: data.answer,
      results: data.results?.map((result: {
        title: string;
        url: string;
        content: string;
        raw_content: string;
        score: number;
      }) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        raw_content: result.raw_content,
        score: result.score
      })) || []
    };

    return NextResponse.json(formattedResults);
  } catch (err) {
    const error = err as Error;
    console.error("Tavily search error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}