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

/**
 * Performs aggregation operations on data
 */
function performAggregation(data, aggregation, endpoint, hasFilters) {
  const { type, field, groupBy } = aggregation;

  if (type === "count") {
    return {
      query_type: "count",
      total_records: data.length,
      data_source: endpoint,
      had_filters: hasFilters,
      result: data.length,
    };
  }

  if (type === "sum" && field) {
    const sum = data.reduce(
      (acc, item) => acc + (parseFloat(item[field]) || 0),
      0
    );
    return {
      query_type: "sum",
      field: field,
      total_records: data.length,
      data_source: endpoint,
      had_filters: hasFilters,
      result: sum,
    };
  }

  if (type === "group" && groupBy) {
    const grouped = {};
    data.forEach((item) => {
      const key = item[groupBy];
      if (!grouped[key]) {
        grouped[key] = {
          count: 0,
          items: [],
        };
      }
      grouped[key].count += 1;
      grouped[key].items.push(item);
    });

    // Convert to array and sort by count descending
    const result = Object.entries(grouped)
      .map(([key, value]) => ({
        [groupBy]: key,
        count: value.count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      query_type: "group",
      grouped_by: groupBy,
      total_records: data.length,
      data_source: endpoint,
      had_filters: hasFilters,
      group_count: result.length,
      result: result,
    };
  }

  if (type === "group" && field) {
    // Group by and aggregate a field (e.g., sum by group)
    const grouped = {};
    data.forEach((item) => {
      const key = item[groupBy] || "unknown";
      if (!grouped[key]) {
        grouped[key] = {
          sum: 0,
          count: 0,
          avg: 0,
        };
      }
      grouped[key].sum += parseFloat(item[field]) || 0;
      grouped[key].count += 1;
    });

    const result = Object.entries(grouped)
      .map(([key, value]) => ({
        [groupBy]: key,
        total: value.sum,
        count: value.count,
        average: value.sum / value.count,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      query_type: "group_aggregate",
      grouped_by: groupBy,
      aggregated_field: field,
      total_records: data.length,
      data_source: endpoint,
      had_filters: hasFilters,
      group_count: result.length,
      result: result,
    };
  }

  return { error: "Invalid aggregation parameters", data: [] };
}

export const queryApiDataTool = tool(
  async ({
    endpoint,
    params,
    fields,
    filters,
    topK,
    sortBy,
    sortOrder,
    aggregation,
  }) => {
    return queryApiData({
      endpoint,
      params,
      fields,
      filters,
      topK,
      sortBy,
      sortOrder,
      aggregation,
    });
  },
  {
    name: "queryApiData",
    description: `Universal function to query API endpoints with filtering, sorting, aggregation, and field selection.

Available endpoints and their fields:
- 'monthly_sales': Monthly sales data (requires empId in params)
- 'top_distributors': Top distributors (requires empId in params)  
- 'employee_data': Employee information (fields: EMP_ID, EMP_NAME, EMP_CODE, PLANT_ID, etc.)
- 'order_history': Current FY orders (fields: CREATED_BY, CUSTOMER_ID, STATUS, STATUS_DESCRIPTION, PLANT_ID, TOTAL_ORDER_VALUE, ORDER_DATE)

Filtering examples:
- Filter by exact match: {CREATED_BY: "MKTG0562"}
- Filter by status: {STATUS_DESCRIPTION: "Pending"}
- Filter by multiple conditions: {CREATED_BY: "MKTG0562", STATUS: 11}
- Filter by range: {TOTAL_ORDER_VALUE: {$gt: 5000}}

Aggregation examples (NEW):
- Count total: {type: "count"} - returns total count of records
- Sum a field: {type: "sum", field: "TOTAL_ORDER_VALUE"} - sums numeric field
- Group by field: {type: "group", groupBy: "CREATED_BY"} - counts records per group, sorted by count
- Group and aggregate: {type: "group", groupBy: "CREATED_BY", field: "TOTAL_ORDER_VALUE"} - groups and sums field

Returns filtered/aggregated JSON array or aggregation result with metadata.`,
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
      aggregation: z
        .object({
          type: z.enum(["count", "sum", "group"]).describe("Aggregation type"),
          field: z
            .string()
            .optional()
            .describe(
              "Field to aggregate (for sum or group aggregation). E.g. 'TOTAL_ORDER_VALUE'"
            ),
          groupBy: z
            .string()
            .optional()
            .describe(
              "Field to group by. E.g. 'CREATED_BY' to group orders by employee"
            ),
        })
        .optional()
        .describe(
          "Aggregation configuration. Use for counting, summing, or grouping operations"
        ),
    }),
  }
);
