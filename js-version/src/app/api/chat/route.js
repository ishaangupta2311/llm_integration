import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { configDotenv } from "dotenv";
configDotenv();

const apiKey = process.env.GEMINI_API_KEY;
const monthlySalesURL = process.env.MONTHLY_SALES_API;
const topDistributorsURL = process.env.TOP_DISTRIBUTORS_API;


/**
 *  This function is used to get the top distributors from the suprsales API.
 *  The top distributors are returned in a list of dictionaries.
 *  Each entry dictionary looks like:
 *    {
 *        "TOTAL_SALES": 5743605.88,
 *        "CUSTOMER_ID": "105709",
 *        "CUSTOMER_NAME": "RAHUL AGRICULTURE CENTRE - JAIPUR-JAIPUR"
 *    }
 *  @param {Number} empId - The employee ID for which to fetch top distributors.
 *  @param {Number} topK - The number of top distributors to fetch. Default is 10.
 *  @returns {Array} Array of dictionaries of top distributors.
 */
async function getTopDistributors({empId, topK = 10, timeout = 15}) {
  console.log(`Tool Call: getTopDistributors(empId=${empId}, topK=${topK})`);

  if (typeof empId !== "number") {
    throw new TypeError("empId must be a positive number");
  }
  if (typeof topK !== "number") {
    throw new TypeError("topK must be a positive number");
  }
  if (
    typeof topDistributorsURL === "undefined" ||
    topDistributorsURL === null
  ) {
    throw new Error("Top distributors URL is not defined");
  }
  try {
    const url = topDistributorsURL + empId;
    const response = await fetch(url);
    const topDistributors = await response.json();
    // Sort by TOTAL_SALES descending, just in case API does not guarantee order
    const sorted = topDistributors.sort(
      (a, b) => (b.TOTAL_SALES || 0) - (a.TOTAL_SALES || 0)
    );
    return sorted.slice(0, topK);
  } catch (e) {
    console.error(`Error in getTopDistributors for empId ${empId}:`, e);
    return [];
  }
}

/**
 * Fetches the monthly sales data for a given employee for the current Fiscal Year.
 * The data is fetched from the suprsales API.
 * @param {Number} empId - The employee ID for which to fetch monthly sales.
 * @returns {Array} Array of monthly sales data for the employee.
 * Each entry in the array looks like :
 * {
 *      "MONTH_YEAR": "April 2025",
 *      "TOTAL_SALES": 5903124.36
 * }
 */
async function getMonthlySales({ empId }) {
  console.log(`Tool Call: getMonthlySales(empId=${empId})`);
  if (typeof empId !== "number") {
    throw new TypeError("empId must be a positive number");
  }
  if (typeof monthlySalesURL === "undefined" || monthlySalesURL === null) {
    throw new Error("Monthly sales endpoint URL is not defined");
  }
  try {
    const url = monthlySalesURL + empId;
    const response = await fetch(url);
    const monthlySales = await response.json();
    return monthlySales;
  } catch (e) {
    console.error(`Error in getMonthlySales for empId ${empId}:`, e);
    return []; // Return empty array on error
  }
}

const getTopDistributorsDeclaration = {
  name: "getTopDistributors",
  description: "Fetches the top distributors for a given employee",
  parameters: {
    type: Type.OBJECT,
    properties: {
      empId: {
        type: Type.NUMBER,
        description: "The employee ID for which to fetch top distributors.",
      },
      topK: {
        type: Type.NUMBER,
        description: "The number of top distributors to fetch. Default is 10.",
        default: 10,
      },
    },
    required: ["empId", "topK"],
  },
};

const getMonthlySalesDeclaration = {
  name: "getMonthlySales",
  description:
    "Fetches the monthly sales data for a given employee for the current Fiscal Year. Use this when asked about monthly sales, trends, or time-based sales analysis.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      empId: {
        type: Type.NUMBER,
        description: "The employee ID for which to fetch monthly sales data.",
      },
    },
    required: ["empId"],
  },
};

const toolFunctions = {
  getTopDistributors,
  getMonthlySales,
};

const config = {
  tools: [
    {
      functionDeclarations: [
        getTopDistributorsDeclaration,
        getMonthlySalesDeclaration,
      ],
    },
  ],
};


export async function POST(req) {
  const { messages } = await req.json();
  const ai = new GoogleGenAI({ apiKey });
  const chat = ai.chats.create({ model: "gemini-2.5-flash", config });

  let response = await chat.sendMessage({
    message: {
      role: "user",
      parts: [{ text: messages[messages.length - 1].content }],
    },
  });

  // Handle function calls
  while (response.functionCalls && response.functionCalls.length > 0) {
    for (const funCall of response.functionCalls) {
      const { name, args } = funCall;
      if (!toolFunctions[name])
        throw new Error(`Unknown function call: ${name}`);
      const toolResponse = await toolFunctions[name](args);
      response = await chat.sendMessage({
        message: {
          role: "user",
          parts: [
            { functionResponse: { name, response: { result: toolResponse } } },
          ],
        },
      });
    }
  }

  // Return the final answer
  const parts = response.candidates[0].content.parts;
  const text = parts.map((part) => part.text).join("\n");
  return NextResponse.json({ text });
}