import { GoogleGenAI, Type } from "@google/genai";
// import { time } from "console";
import { configDotenv } from "dotenv";
// Read API key from env and pass explicitly to avoid ADC fallback
configDotenv();

const apiKey =
  process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error(
    "Missing API key. Set GEMINI_API_KEY or GOOGLE_API_KEY in your environment."
  );
  process.exit(1);
}

async function fetchOrderHistory() {
  try {
    const response = await fetch(fyOrderHistoryURL);
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

async function fetchEmpInfo(url, timeout = 15) {
  /** 
  This function is used to get the employee data from the suprsales API.
  The employee data is a list of JSON objects.
  The employee id is the id of the employee in the database.
  The employee data is returned in a list of dictionaries.
  
  Each entry dictionary looks like:
  {
    "EMP_ID": "10000008",
    "VEHICLE_OWNERSHIP": 2,
    "VEHICLE_TYPE": 2,
    "APPROVER_ID": "10000237",
    "AREA_ID": "INAC",
    "EDITED_BY": "HRM_SUPRT",
    "EMP_CODE": "10000008",
    "EMP_DESIGNATION": "TERRITORY EXECUTIVE",
    "EMP_MOBILE_NO": "7752050355",
    "EMP_NAME": "BISWARANJAN DAS",
    "EMP_TYPE": "PERMANENT",
    "FLAG": "ACTIVE",
    "LOCATION_ID": "21",
    "PLANT_ID": "BALA",
    "REPORTING_MANAGER_ID": "10000237",
    "PASSWORD": "123456",
    "IS_APPROVER": "X",
    "EMP_CONTRACT_TYPE": null,
    "EMP_EMAIL": "",
    "IS_ADMIN": null,
    "COMPANY_ID": "C08",
    "LEVEL_DESC": "TERRITORY EXECUTIVE",
    "LEVEL_ID": "TERRITORYEXECUTIVE",
    "REGION_ID": "21",
    "REGION_DESC": "Odisha"
    }
    */

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `HTTP error while fetching employee info: ${response.status}`
      );
      return [];
    }
    const employeeData = await response.json();
    return employeeData;
  } catch (e) {
    console.error("Error fetching employee data:", e);
    return [];
  }
}

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
 * Filters the employee data to only include the EMP_ID and EMP_NAME fields.
 * Returns an array of objects with only these two fields.
 * Each entry looks like:
 *   { EMP_ID: "10000008", EMP_NAME: "BISWARANJAN DAS" }
 *
 * @param {Array} employeeDataCache - Array of employee objects. If not provided, uses _employeeDataCache.
 * @returns {Array} Filtered array with EMP_ID and EMP_NAME of each employee only.
 */
function filterEmployeeData(employeeDataCache) {
  // Fallback to global cache if not provided
  if (typeof employeeDataCache === "undefined" || employeeDataCache === null) {
    if (
      typeof _employeeDataCache === "undefined" ||
      _employeeDataCache === null
    ) {
      throw new Error(
        "Employee data cache is not available. Please fetch data first."
      );
    }
    employeeDataCache = _employeeDataCache;
  }

  if (!Array.isArray(employeeDataCache)) {
    throw new TypeError("employeeDataCache must be an array");
  }

  return employeeDataCache.map((emp) => ({
    EMP_ID: emp.EMP_ID,
    EMP_NAME: emp.EMP_NAME,
  }));
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

const fetchOrderHistoryDeclaration = {
  name: "fetchOrderHistory",
  description: ```Fetches the order history for the current financial year. Use this to get order details such as created_by, customer_id, plant_id, order_value, and order_date. This can help in analyzing order patterns and customer behavior as well as employee performance. The Employee Id is the same as Created_by field in order history.
  Output is an array of JSON objects with the following fields:
  [
    {
      CREATED_BY: The EMP_ID of the employee who created the order.
      CUSTOMER_ID: The ID of the customer who placed the order.
      CUST_TYPE_CODE: The type code of the customer.
      PLANT_ID: The ID of the plant where the order was placed.
      TOTAL_ORDER_VALUE: The total value of the order.
      ORDER_DATE: The date when the order was placed.
    },
  ]
  ```,
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
};


/* TEST CODE FOR THE FILE STARTS HERE  : */
let _employeeDataCache = null;
let filteredEmployeeData = null;

const monthlySalesURL =
  "https://suprsales.in:5032/suprsales_api/Dashboard/monthlySalesChart?id=";
const topDistributorsURL =
  "https://suprsales.in:5032/suprsales_api/Dashboard/topDistributor?id=";
const employeeDataURL =
  "https://suprsales.in:5032/suprsales_api/Employee/index";
const CurrentFinancialYearOrderHistoryURL =
  "https://suprsales.in:5034/suprsales_api/Order/getCurrentFinancialYearOrder";


_employeeDataCache = await fetchEmpInfo(employeeDataURL);
filteredEmployeeData = filterEmployeeData(_employeeDataCache);
const filteredOrderHistory = await fetchOrderHistory(); // No additional filtering needed here

const config = {
  tools: [
    {
      functionDeclarations: [
        getTopDistributorsDeclaration,
        fetchOrderHistoryDeclaration,
        getMonthlySalesDeclaration,
      ],
    },
  ],
};

const prompt =
  "hello";

const ai = new GoogleGenAI({ apiKey });

// const chat = ai.chats.create({
//   model: "gemini-2.5-flash",
//   config: config,
// });

// // Start the chat with the user prompt
// let response = await chat.sendMessage({
//   message: {
//     role: "user",
//     parts: [{ text: prompt }],
//   },
// });

const toolFunctions = {
  getTopDistributors,
  getMonthlySales,
};

console.log("______________________________");
console.log(filteredOrderHistory[10]);
// while (response.functionCalls && response.functionCalls.length > 0) {
//   for (const funCall of response.functionCalls) {
//     const { name, args } = funCall;
//     if (!toolFunctions[name]) throw new Error(`Unknown function call: ${name}`);
//     console.log(`Executing function: ${name} with args:`, args);
//     const toolResponse = await toolFunctions[name](args);
//     // Send the function response back to the chat
//     response = await chat.sendMessage({
//       message: {
//         role: "user",
//         parts: [
//           {
//             functionResponse: {
//               name,
//               response: { result: toolResponse },
//             },
//           },
//         ],
//       },
//     });
//   }
// }

// // Print the final answer
// const parts = response.candidates[0].content.parts;
// for (const part of parts) {
//   if (part.text) {
//     console.log(part.text);
//   }
// }
// console.log(chat);
// console.log("______________________________");
// console.log(chat.getHistory());
// console.log("______________________________");
// console.log("response:", response);
// const resp = chat.sendMessage({
//   message: "my employee id is 10000009. show me everything you can do with it.",
// })
// console.log
/**
 * Check if response content contains various parts.
 * Loop over each part:
 *  If part contains function calls, execute them.
 *  else skip.
 * If parts contains only text, print it.
 */

/*
tesing api calls and returned values here |
                                         \|/ 
                                          ' 
*/
// const topDistributors = await getTopDistributors(10000009, 3);
// console.log("Top Distributors for employee 10000009:", topDistributors);
// console.log("Monthly sales for employee 10000009:", await getMonthlySales(10000009));
