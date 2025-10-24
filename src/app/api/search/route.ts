import { NextRequest, NextResponse } from "next/server";
import { AxiosError } from "axios";

export async function POST(req: NextRequest) {
  try {
    const { query, max_results = 3, include_domains = ["ey.com"] } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query required" }, { status: 400 });
    }

    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_API_KEY) {
      return NextResponse.json({ error: "Tavily API key missing" }, { status: 500 });
    }

    console.log(`🔍 Tavily search: "${query}" (max: ${max_results}, domains: ${include_domains.join(", ")})`);

    // Match Tavily's actual API format
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results,
        include_answer: true,
        include_raw_content: false,
        include_domains
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Tavily API error:", errorText);
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log(`✅ Tavily returned ${data.results?.length || 0} results`);
    
    // 🚀 ADD EDGE CACHING FOR SEARCH RESULTS
    const successResponse = NextResponse.json({ 
      results: data.results || [],
      answer: data.answer || null
    });
    
    // Cache search results for 10 minutes (EY.com content doesn't change frequently)
    // Different queries get cached separately due to automatic cache key generation
    successResponse.headers.set('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    
    return successResponse;

  } catch (err) {
    const error = err as AxiosError<{ error?: { message?: string } }>;
    
    // Don't cache error responses
    const errorResponse = NextResponse.json(
      { error: error.response?.data?.error?.message || error.message || "Search failed" },
      { status: 500 }
    );
    errorResponse.headers.set('Cache-Control', 'no-cache');
    return errorResponse;
  }
}