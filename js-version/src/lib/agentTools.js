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
const currentFinancialYearOrderHistoryURL =
  "https://suprsales.in:5034/suprsales_api/Order/getCurrentFinancialYearOrder";

const endpoints = {
  monthly_sales: (empId) => `${monthlySalesURL}${empId}`,
  top_distributors: (empId) => `${topDistributorsURL}${empId}`,
  employee_data: () => employeeDataURL,
  order_history: () => CurrentFinancialYearOrderHistoryURL,
};


const filteredOrderHistory = await fetchOrderHistory();
const topDistributorsCache = await getTopDistributors({ empId: 1, topK: 10 });
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
async function getTopDistributors({ empId, topK = 10,}) {
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
    // return JSON.stringify(sorted.slice(0, topK));
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
    return JSON.stringify(monthlySales);
  } catch (e) {
    console.error(`Error in getMonthlySales for empId ${empId}:`, e);
    return []; // Return empty array on error
  }
}

async function fetchOrderHistory() {
  try {
    const response = await fetch(currentFinancialYearOrderHistoryURL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    // Filter each order to only keep the required fields
    const orderHistoryCache = Array.isArray(data)
      ? data.map((order) => ({
          CREATED_BY: order.CREATED_BY,
          CUSTOMER_ID: order.CUSTOMER_ID,
          CUST_TYPE_CODE: order.CUST_TYPE_CODE,
          PLANT_ID: order.PLANT_ID,
          TOTAL_ORDER_VALUE: order.TOTAL_ORDER_VALUE,
          ORDER_DATE: order.ORDER_DATE,
        }))
      : [];
    return orderHistoryCache;
  } catch (error) {
    console.error("Failed to fetch order history:", error);
    return [];
  }
}
export const fetchOrderHistoryTool = tool(
  async () => {
    return fetchOrderHistory();
  },
  {
    name: "fetchOrderHistory",
    description: `Fetches the order history for the current financial year. Use this to get order details such as created_by, customer_id, plant_id, order_value, and order_date. This can help in analyzing order patterns and customer behavior as well as employee performance. The Employee Id is the same as Created_by field in order history.
    Output is an array of JSON objects with the following fields:
    [
      {
      CREATED_BY: The EMP_ID of the employee who created the order.
      CUSTOMER_ID: The ID of the customer who placed the ordjer.
      CUST_TYPE_CODE: The type code of the customer.
      PLANT_ID: The ID of the plant where the order was placed.
      TOTAL_ORDER_VALUE: The total value of the order.
      ORDER_DATE: The date when the order was placed.
    },
  ]
  `,
  schema: z.object({}),
  }
);

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

// Exported tools only; no side-effectful test calls here.
