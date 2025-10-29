import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { configDotenv } from "dotenv";
import { runAgent } from "@/lib/langgraphAgent";

configDotenv();

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const threadId = req.headers.get("x-thread-id") || "web-chat";
    const result = await runAgent(messages, threadId);
    const text = typeof result === "string" ? result : result?.text;
    const tools =
      typeof result === "object" && Array.isArray(result?.tools)
        ? result.tools
        : [];
    return NextResponse.json({ text: text || "", tools });
  } catch (e) {
    console.error("/api/chat error:", e);
    return NextResponse.json(
      {
        text: "Sorry, something went wrong while generating a response.",
        tools: [],
      },
      { status: 500 }
    );
  }
}
