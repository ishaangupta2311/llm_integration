// src/lib/langgraphAgent.js

import { StateGraph, MemorySaver } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
// import { getTopDistributorsTool, getMonthlySalesTool, fetchOrderHistoryTool } from "@/lib/agentTools.js";
import { queryApiDataTool } from "./agentTools.js";
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
// configDotenv({ path: path.resolve(__dirname, "../.env") });
configDotenv();

const SYSTEM_PROMPT = `You are the frontline support agent for a company. You are responsible for answering questions and assisting users with their issues. Always provide data-driven insights with specific numbers.`;

const GOOGLE_API_KEY = process.env.GEMINI_API_KEY;

const agentTools = [queryApiDataTool];

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
  try {
    // Prepend system prompt to guide agent behavior
    const messagesWithSystem = [
      // { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];
    const lcMessages = mapChatMessagesToLC(messagesWithSystem);
    const state = await agent.invoke(
      { messages: lcMessages },
      { configurable: { thread_id: String(threadId) } }
    );
    const final = state.messages[state.messages.length - 1];
    // Extract tool calls and outputs created during this invoke
    const newMessagesStart = Array.isArray(lcMessages) ? lcMessages.length : 0;
    const newMessages = state.messages.slice(newMessagesStart);
    // Build correlated tool call and output lists to avoid duplicates
    const calls = [];
    const outputs = [];

    for (const m of newMessages) {
      const toolCalls =
        (Array.isArray(m?.additional_kwargs?.tool_calls)
          ? m.additional_kwargs.tool_calls
          : null) ||
        (Array.isArray(m?.tool_calls) ? m.tool_calls : null) ||
        [];

      for (const call of toolCalls) {
        const name = call?.function?.name || call?.name || m?.name || m?.tool;
        const id = call?.id || undefined;
        let input = call?.function?.arguments ?? call?.arguments ?? call?.input;
        if (typeof input === "string") {
          try {
            input = JSON.parse(input);
          } catch (_) {}
        }
        calls.push({ id, name, input: input ?? {} });
      }

      const toolName = m?.tool || m?.tool_name || m?.name;
      const toolCallId = m?.tool_call_id || undefined;
      const content =
        typeof m?.content === "string"
          ? m.content
          : m?.content != null
          ? JSON.stringify(m.content)
          : undefined;
      if (toolName && (toolCallId || content)) {
        outputs.push({ id: toolCallId, name: toolName, content });
      }
    }

    // Create entries from calls, keying by id when present, otherwise by name+index
    const toolsMap = new Map();
    const nameIndex = new Map();
    for (const c of calls) {
      const index = (nameIndex.get(c.name) || 0) + 1;
      nameIndex.set(c.name, index);
      const key = c.id || `${c.name}#${index}`;
      toolsMap.set(key, {
        toolCallId: c.id,
        name: c.name,
        type: c.name,
        input: c.input,
        output: undefined,
        state: "input-available",
        errorText: undefined,
      });
    }

    // Attach outputs. Prefer exact id, else first matching name without output
    for (const o of outputs) {
      let key;
      if (o.id && toolsMap.has(o.id)) {
        key = o.id;
      } else {
        for (const [k, v] of toolsMap.entries()) {
          if (v.name === o.name && v.output === undefined) {
            key = k;
            break;
          }
        }
      }

      if (key !== undefined) {
        const entry = toolsMap.get(key);
        entry.output = o.content;
        entry.state = o.content ? "output-available" : entry.state;
        toolsMap.set(key, entry);
      } else {
        const fallbackKey = o.id || `${o.name}#fallback`;
        if (!toolsMap.has(fallbackKey)) {
          toolsMap.set(fallbackKey, {
            toolCallId: o.id,
            name: o.name,
            type: o.name,
            input: {},
            output: o.content,
            state: o.content ? "output-available" : "running",
            errorText: undefined,
          });
        }
      }
    }

    const tools = Array.from(toolsMap.values());
    const text = typeof final?.content === "string" ? final.content : "";
    return { text, tools };
  } catch (error) {
    console.error("Agent execution error:", error);

    // Handle rate limit errors specifically
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      return {
        text: "I've hit the API rate limit. Please wait a moment and try again, or ask for more specific data with filters to reduce the response size.",
        tools: [],
      };
    }

    // Handle other errors
    if (error.message?.includes("Unknown content")) {
      return {
        text: "There was an issue processing the data. Please try asking for more specific information or use filters to narrow down the results.",
        tools: [],
      };
    }

    return {
      text: "I encountered an error while processing your request. Please try again with a more specific query.",
      tools: [],
    };
  }
}
