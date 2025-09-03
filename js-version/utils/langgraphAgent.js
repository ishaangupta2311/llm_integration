import { StateGraph, MemorySaver } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getTopDistributorsTool, getMonthlySalesTool } from "./agentTools.js";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { configDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
configDotenv({ path: path.resolve(__dirname, "../.env") });



const agentTools = [getTopDistributorsTool, getMonthlySalesTool];

const agentModel = new ChatGoogleGenerativeAI({ temperature: 0 });
const agentCheckpointer = new MemorySaver();

const agent = createReactAgent({
  llm: agentModel,
  tools: agentTools,
  checkpointSaver: agentCheckpointer,
});

const agentFinalState = await agent.invoke(
  { messages: [new HumanMessage("Hello, how are you? my empid is 100009")] },
  { configurable: { thread_id: "42" } }
);

console.log(agentFinalState.messages[agentFinalState.messages.length - 1].content);

const agentNextState = await agent.invoke(
  {messages: [new HumanMessage("Who is my top distributor?")]},
)