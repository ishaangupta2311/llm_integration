// src/lib/agentTools.js

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
  aggregation = null, // NEW: {type: 'count'|'sum'|'group', field?: string, groupBy?: string}
}) {
  console.log(
    `Tool Call: queryApiData(` +
      `endpoint=${endpoint}, ` +
      `params=${JSON.stringify(params)}, ` +
      `fields=${JSON.stringify(fields)}, ` +
      `filters=${JSON.stringify(filters)}, ` +
      `topK=${topK}, ` +
      `sortBy=${sortBy}, ` +
      `sortOrder=${sortOrder}, ` +
      `aggregation=${JSON.stringify(aggregation)}` +
      `)`
  );

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
    order_history: 100, // Max 100 orders (only when no filters are applied)
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

    // Apply filters FIRST (before topK limiting)
    const hasFilters = !!(filters && Object.keys(filters).length > 0);
    if (hasFilters) {
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

    // Handle aggregation BEFORE topK
    if (aggregation) {
      return JSON.stringify(
        performAggregation(data, aggregation, endpoint, hasFilters)
      );
    }

    // Apply topK limit
    const shouldApplyDefaultCap = !hasFilters || endpoint !== "order_history";
    const effectiveTopK =
      topK || (shouldApplyDefaultCap ? defaultLimits[endpoint] : null);
    if (effectiveTopK && effectiveTopK > 0) {
      data = data.slice(0, effectiveTopK);
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

    // For large datasets, provide summary
    if (data.length > 50 && !topK && !aggregation) {
      const summary = {
        total_records: data.length,
        sample_data: data.slice(0, 5),
        message: `Showing first 5 of ${data.length} records. Use filters, topK, or aggregation for specific results.`,
      };
      return JSON.stringify(summary);
    }

    return JSON.stringify(data);
  } catch (error) {
    console.error("Error in queryApiData:", error);
    return JSON.stringify({ error: error.message, data: [] });
  }
}

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
    description: `Universal function to query API endpoints with filtering, sorting, and field selection.

Available endpoints and their fields:
- 'monthly_sales': Monthly sales data (requires empId in params)
- 'top_distributors': Top distributors (requires empId in params)  
- 'employee_data': Employee information (fields: EMP_ID, EMP_NAME, EMP_CODE, PLANT_ID, etc.)
- 'order_history': Current FY orders (fields: CREATED_BY, CUSTOMER_ID, STATUS, STATUS_DESCRIPTION, PLANT_ID, TOTAL_ORDER_VALUE, ORDER_DATE)

Filtering examples:
- Filter by exact match: {CREATED_BY: "MKTG0562"}
- Filter by status description: {STATUS_DESCRIPTION: "Pending"}
- Filter by multiple conditions: {CREATED_BY: "MKTG0562", STATUS: 11}
- Filter by range: {TOTAL_ORDER_VALUE: {$gt: 5000}}

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
          "Filter conditions as key-value pairs. Examples: {CREATED_BY: 'MKTG0562'}, {STATUS_DESCRIPTION: 'Pending'}, {PLANT_ID: 'BALA', STATUS: 11}"
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
