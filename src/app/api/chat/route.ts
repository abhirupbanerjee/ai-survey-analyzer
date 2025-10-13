import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface SearchArgs {
  query: string;
  max_results?: number;
  include_domains?: string[];
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

    // Get or create thread
    let currentThreadId = threadId;
    if (!currentThreadId) {
      const threadRes = await axios.post(
        "https://api.openai.com/v1/threads",
        {},
        { headers }
      );
      currentThreadId = threadRes.data.id;
      console.log(`🆕 Created new thread: ${currentThreadId}`);
    } else {
      console.log(`♻️ Using existing thread: ${currentThreadId}`);
    }

    // Add user message
    await axios.post(
      `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
      { role: "user", content: input },
      { headers }
    );
    console.log(`💬 User message added to thread`);

    // Create run
    const runRes = await axios.post(
      `https://api.openai.com/v1/threads/${currentThreadId}/runs`,
      { assistant_id: ASSISTANT_ID },
      { headers }
    );

    const runId = runRes.data.id;
    let status = "in_progress";
    let retries = 0;
    const maxRetries = 200; // 120 seconds (60 retries × 2s)

    console.log(`🚀 Run started: ${runId}`);

    // Poll for completion or required action
    while ((status === "in_progress" || status === "queued" || status === "requires_action") && retries < maxRetries) {
      await new Promise((res) => setTimeout(res, 2000));
      
      const statusRes = await axios.get(
        `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`,
        { headers }
      );
      
      status = statusRes.data.status;
      console.log(`📊 Run status: ${status} (retry ${retries}/${maxRetries})`);

      // Handle function calls
      if (status === "requires_action") {
        const toolCalls: ToolCall[] = statusRes.data.required_action?.submit_tool_outputs?.tool_calls || [];
        
        if (toolCalls.length > 0) {
          console.log(`🔧 Processing ${toolCalls.length} function call(s)`);
          
          const toolOutputs = await Promise.all(
            toolCalls.map(async (toolCall: ToolCall) => {
              if (toolCall.function.name === "web_search") {
                try {
                  const args: SearchArgs = JSON.parse(toolCall.function.arguments);
                  
                  console.log("🔍 Web search called:", args.query);
                  
                  // Call our search endpoint
                  const baseUrl = process.env.VERCEL_URL 
                    ? `https://${process.env.VERCEL_URL}` 
                    : "http://localhost:3000";
                  
                  console.log(`📡 Calling search API: ${baseUrl}/api/search`);
                  
                  const searchResponse = await fetch(`${baseUrl}/api/search`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      query: args.query,
                      max_results: args.max_results || 3,
                      include_domains: args.include_domains || ["ey.com"]
                    })
                  });

                  if (!searchResponse.ok) {
                    const errorText = await searchResponse.text();
                    console.error("❌ Search endpoint error:", errorText);
                    throw new Error(`Search failed: ${searchResponse.status}`);
                  }

                  const searchData = await searchResponse.json();
                  console.log(`✅ Search returned ${searchData.results?.length || 0} results`);
                  
                  // Format results for OpenAI
                  const formattedResults = {
                    results: searchData.results || [],
                    answer: searchData.answer || null,
                    query: args.query
                  };
                  
                  return {
                    tool_call_id: toolCall.id,
                    output: JSON.stringify(formattedResults)
                  };
                  
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : "Unknown error";
                  console.error("❌ Search execution error:", errorMessage);
                  return {
                    tool_call_id: toolCall.id,
                    output: JSON.stringify({ 
                      error: errorMessage,
                      results: [] 
                    })
                  };
                }
              }
              
              return {
                tool_call_id: toolCall.id,
                output: JSON.stringify({ error: "Unknown function" })
              };
            })
          );

          // Submit tool outputs
          await axios.post(
            `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}/submit_tool_outputs`,
            { tool_outputs: toolOutputs },
            { headers }
          );
          
          console.log("✅ Tool outputs submitted");
          status = "in_progress"; // Continue polling
        }
      }

      retries++;
    }

    // Handle timeout - CANCEL the run
    if (status !== "completed" && status !== "failed" && status !== "cancelled") {
      console.error(`⏱️ Run timeout after ${maxRetries * 2} seconds. Status: ${status}`);
      
      try {
        // Cancel the stuck run
        await axios.post(
          `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}/cancel`,
          {},
          { headers }
        );
        console.log("🛑 Cancelled stuck run");
      } catch (cancelError) {
        console.error("❌ Failed to cancel run:", cancelError instanceof Error ? cancelError.message : "Unknown error");
      }
      
      return NextResponse.json(
        { 
          error: "Request timeout. The assistant is taking longer than expected. Please try again.",
          threadId: currentThreadId 
        },
        { status: 504 }
      );
    }

    // Get final response
    let reply = "No response received.";
    if (status === "completed") {
      const messagesRes = await axios.get(
        `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
        { headers }
      );
      const assistantMsg = messagesRes.data.data.find((m: { role: string }) => m.role === "assistant");
      reply =
        assistantMsg?.content?.[0]?.text?.value?.replace(/【\d+:\d+†[^】]+】/g, "") ||
        "No valid response.";
      
      console.log("✅ Run completed successfully");
    } else if (status === "failed") {
      console.error("❌ Run failed");
      reply = "The assistant encountered an error. Please try again.";
    } else if (status === "cancelled") {
      console.log("🛑 Run was cancelled");
      reply = "Request was cancelled. Please try again.";
    } else {
      console.error(`⚠️ Unexpected final status: ${status}`);
      reply = "Unexpected error occurred. Please try again.";
    }

    return NextResponse.json({ reply, threadId: currentThreadId });
    
  } catch (err) {
    const error = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
    console.error("💥 Chat API error:", error);
    return NextResponse.json(
      { error: error.response?.data?.error?.message || error.message || "Unknown error" },
      { status: 500 }
    );
  }
}