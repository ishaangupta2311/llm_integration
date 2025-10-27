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
const employeeDataURL = process.env.EMPLOYEE_DATA_API;
const currentFinancialYearOrderHistoryURL =
  "https://suprsales.in:5034/suprsales_api/Order/getCurrentFinancialYearOrder";

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
async function getTopDistributors({ empId, topK = 10 }) {
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
 * Universal API query function that handles multiple data endpoints
 * Optimized to prevent token limit issues and rate limiting
 */
async function queryApiData({
  endpoint,
  params = {},
  fields = null,
  filters = {},
  topK = null,
  sortBy = null,
  sortOrder = "desc",
}) {
  console.log(`Tool Call: queryApiData(endpoint=${endpoint}, topK=${topK})`);

  const endpoints = {
    monthly_sales: (empId) => `${monthlySalesURL}${empId}`,
    top_distributors: (empId) => `${topDistributorsURL}${empId}`,
    employee_data: () => employeeDataURL,
    order_history: () => currentFinancialYearOrderHistoryURL,
  };

  // Default limits to prevent massive data dumps
  const defaultLimits = {
    monthly_sales: 12, // Max 12 months
    top_distributors: 20, // Max 20 distributors
    employee_data: 50, // Max 50 employees
    order_history: 100, // Max 100 orders
  };

  try {
    if (!endpoints[endpoint]) {
      throw new Error(`Unsupported endpoint: ${endpoint}`);
    }

    const url = endpoints[endpoint](params?.empId);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    let data = await response.json();
    if (!Array.isArray(data)) data = [data];

    // Apply default limit if no topK specified
    const effectiveTopK = topK || defaultLimits[endpoint];
    if (effectiveTopK && effectiveTopK > 0) {
      data = data.slice(0, effectiveTopK);
    }

    if (filters && Object.keys(filters).length > 0) {
      data = data.filter((item) => {
        return Object.entries(filters).every(([key, value]) => {
          if (value && typeof value === "object") {
            if (value.$gt !== undefined && !(item[key] > value.$gt))
              return false;
            if (value.$lt !== undefined && !(item[key] < value.$lt))
              return false;
            return true;
          }
          return item[key] === value;
        });
      });
    }

    if (sortBy && data.length > 0) {
      data.sort((a, b) => {
        const aVal = a?.[sortBy] ?? 0;
        const bVal = b?.[sortBy] ?? 0;
        return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
      });
    }

    if (fields && Array.isArray(fields)) {
      data = data.map((item) => {
        const projected = {};
        for (const field of fields) {
          if (Object.prototype.hasOwnProperty.call(item, field)) {
            projected[field] = item[field];
          }
        }
        return projected;
      });
    }

    // For large datasets, provide summary instead of full data
    if (data.length > 50) {
      const summary = {
        total_records: data.length,
        sample_data: data.slice(0, 5),
        message: `Showing first 5 of ${data.length} records. Use filters or topK to get specific results.`,
      };
      return JSON.stringify(summary);
    }

    // Serialize the data to ensure compatibility with LangChain
    return JSON.stringify(data);
  } catch (error) {
    console.error("Error in queryApiData:", error);
    return JSON.stringify({ error: error.message, data: [] });
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


export const queryApiDataTool = tool(
  async ({ endpoint, params, fields, filters, topK, sortBy, sortOrder }) => {
    return queryApiData({
      endpoint,
      params,
      fields,
      filters,
      topK,
      sortBy,
      sortOrder,
    });
  },
  {
    name: "queryApiData",
    description: `Universal function to query API endpoints intelligently 
    Available endpoints:
  - 'monthly_sales': Monthly sales data (requires empId)
  - 'top_distributors': Top distributors (requires empId)  
  - 'employee_data': All employee information
  - 'order_history': Current financial year orders
  
  Returns filtered JSON array based on specified criteria.`,
    schema: z.object({
      endpoint: z
        .enum([
          "monthly_sales",
          "top_distributors",
          "employee_data",
          "order_history",
        ])
        .describe("API endpoint identifier"),
      params: z
        .object({ empId: z.number().int().optional() })
        .partial()
        .optional()
        .describe("Parameters like {empId: 10000009}"),
      fields: z
        .array(z.string())
        .optional()
        .describe(
          "Specific fields to extract (e.g., ['EMP_NAME', 'TOTAL_SALES'])"
        ),
      filters: z
        .record(z.any())
        .optional()
        .describe(
          "Filter conditions (e.g., {PLANT_ID: 'BALA'} or {TOTAL_SALES: {$gt: 1000}})"
        ),
      topK: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Number of top results to return"),
      sortBy: z.string().optional().describe("Field to sort by"),
      sortOrder: z.enum(["desc", "asc"]).default("desc").optional(),
    }),
  }
);

// Exported tools only; no side-effectful test calls here.
