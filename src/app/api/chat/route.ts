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

interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

// Function to call Tavily search - Flexible domain support
async function searchWeb(query: string, max_results: number = 3, include_domains: string[] = []) {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, max_results, include_domains }),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Web search error:", error);
    return { error: "Web search failed", results: [] };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { input, threadId } = await req.json();

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

    if (!OPENAI_API_KEY || !ASSISTANT_ID) {
      return NextResponse.json({ error: "Missing OpenAI credentials" }, { status: 500 });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    };

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

    // Create run with tools
    const runRes = await axios.post(
      `https://api.openai.com/v1/threads/${currentThreadId}/runs`,
      { 
        assistant_id: ASSISTANT_ID,
        tools: [
          {
            type: "function",
            function: {
              name: "web_search",
              description: "Search the web for current information, news, research, or data. Use this when users ask about recent events, current statistics, latest news, company insights, or any information that might have changed since your last update. You can search specific domains or the entire web.",
              parameters: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "The search query to find relevant information"
                  },
                  max_results: {
                    type: "integer",
                    description: "Maximum number of search results to return (default: 3, max: 10)",
                    default: 3
                  },
                  include_domains: {
                    type: "array",
                    items: {
                      type: "string"
                    },
                    description: "Optional: Specific domains to search within (e.g., ['ey.com', 'deloitte.com']). Leave empty to search all domains.",
                    default: []
                  }
                },
                required: ["query"]
              }
            }
          }
        ]
      },
      { headers }
    );

    const runId = runRes.data.id;
    let status = "in_progress";
    let retries = 0;
    const maxRetries = 100;

    // Poll for completion and handle function calls
    while ((status === "in_progress" || status === "queued" || status === "requires_action") && retries < maxRetries) {
      await new Promise((res) => setTimeout(res, 3500));
      
      const statusRes = await axios.get(
        `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`,
        { headers }
      );
      
      status = statusRes.data.status;

      // Handle function calls
      if (status === "requires_action" && statusRes.data.required_action?.type === "submit_tool_outputs") {
        const toolCalls = statusRes.data.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = [];

        for (const toolCall of toolCalls) {
          if (toolCall.function.name === "web_search") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              // Support flexible domain filtering
              const searchResults = await searchWeb(
                args.query, 
                args.max_results || 3,
                args.include_domains || []
              );
              
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify(searchResults)
              });
            } catch (error) {
              console.error("Function call error:", error);
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({ error: "Search function failed", results: [] })
              });
            }
          }
        }

        // Submit tool outputs
        await axios.post(
          `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}/submit_tool_outputs`,
          { tool_outputs: toolOutputs },
          { headers }
        );
      }

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
    } else if (status === "failed") {
      reply = "I apologize, but I encountered an error while processing your request. Please try again.";
    } else if (retries >= maxRetries) {
      reply = "The response is taking longer than expected. Please try again or rephrase your question.";
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
    
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error.response?.data?.error?.message || error.message || "Unknown error" },
      { status: 500 }
    );
  }
}