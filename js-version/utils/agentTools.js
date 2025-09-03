import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { configDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
configDotenv({ path: path.resolve(__dirname, "../.env") });

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
async function getTopDistributors({ empId, topK = 10, timeout = 15 }) {
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

// Zod-validated tool instances as recommended by LangGraph/LCJS
export const getTopDistributorsTool = tool(
  async ({ empId, topK }) => {
    const limit = typeof topK === "number" ? topK : 10;
    return getTopDistributors({ empId, topK: limit });
  },
  {
    name: "getTopDistributors",
    description:
      "Fetches the top distributors for a given employee, ordered by TOTAL_SALES.",
    schema: z.object({
      empId: z
        .number({
          required_error: "empId is required",
          invalid_type_error: "empId must be a number",
        })
        .int(),
      topK: z
        .number({ invalid_type_error: "topK must be a number" })
        .int()
        .min(1)
        .default(10)
        .optional(),
    }),
  }
);

export const getMonthlySalesTool = tool(
  async ({ empId }) => {
    return getMonthlySales({ empId });
  },
  {
    name: "getMonthlySales",
    description:
      "Fetches the monthly sales data for a given employee for the current fiscal year.",
    schema: z.object({
      empId: z
        .number({
          required_error: "empId is required",
          invalid_type_error: "empId must be a number",
        })
        .int(),
    }),
  }
);

export { getTopDistributorsTool, getMonthlySalesTool };
