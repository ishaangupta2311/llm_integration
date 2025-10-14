import { StateGraph, MemorySaver } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getTopDistributorsTool, getMonthlySalesTool, fetchOrderHistoryTool } from "@/lib/agentTools.js";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { configDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
configDotenv({ path: path.resolve(__dirname, "../.env") });

const GOOGLE_API_KEY = process.env.GEMINI_API_KEY;

const agentTools = [getTopDistributorsTool, getMonthlySalesTool];

const agentModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0,
  apiKey: GOOGLE_API_KEY,
});
const agentCheckpointer = new MemorySaver();

const agent = createReactAgent({
  llm: agentModel,
  tools: agentTools,
  checkpointSaver: agentCheckpointer,
});

function mapChatMessagesToLC(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m.content === "string" && m.role)
    .map((m) => {
      if (m.role === "user") return new HumanMessage(m.content);
      if (m.role === "assistant") return new AIMessage(m.content);
      if (m.role === "system") return new SystemMessage(m.content);
      return new HumanMessage(m.content);
    });
}

export async function runAgent(messages, threadId = "default") {
  const lcMessages = mapChatMessagesToLC(messages);
  const state = await agent.invoke(
    { messages: lcMessages },
    { configurable: { thread_id: String(threadId) } }
  );
  const final = state.messages[state.messages.length - 1];
  return typeof final?.content === "string" ? final.content : "";
}
