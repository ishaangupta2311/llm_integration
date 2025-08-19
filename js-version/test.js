import { GoogleGenAI } from "@google/genai";
import { time } from "console";
import { configDotenv } from "dotenv";
// Read API key from env and pass explicitly to avoid ADC fallback
configDotenv();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error(
    "Missing API key. Set GEMINI_API_KEY or GOOGLE_API_KEY in your environment."
  );
  process.exit(1);
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
    const employeeData = response.json();
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
async function getTopDistributors(empId, topK=10, timeout=15) {
  if( typeof empId !== "number") { 
    throw new TypeError("empId must be a positive number");
  }
  if( typeof topK !== "number") {
    throw new TypeError("topK must be a positive number");
  }
  if (typeof topDistributorsURL === "undefined" || topDistributorsURL === null) {
    throw new Error("Top distributors URL is not defined");
  }
  const url = topDistributorsURL + empId;
  const response = await fetch(url);
  const topDistributors = await response.json();
  // if (!Array.isArray(topDistributors)) {
  //   throw new Error("API response is not an array");
  // }
  // Sort by TOTAL_SALES descending, just in case API does not guarantee order
  const sorted = topDistributors.sort(
    (a, b) => (b.TOTAL_SALES || 0) - (a.TOTAL_SALES || 0)
  );
  return sorted.slice(0, topK);

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
    if (typeof _employeeDataCache === "undefined" || _employeeDataCache === null) {
      throw new Error("Employee data cache is not available. Please fetch data first.");
    }
    employeeDataCache = _employeeDataCache;
  }

  if (!Array.isArray(employeeDataCache)) {
    throw new TypeError("employeeDataCache must be an array");
  }

  return employeeDataCache.map(emp => ({
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
async function getMonthlySales(empId){
  if (typeof empId !== "number") {
    throw new TypeError("empId must be a positive number");
  }
  if (typeof monthlySalesURl === "undefined" || monthlySalesURl === null) {
    throw new Error("Monthly sales endpoint URL is not defined");
  }
  const url = monthlySalesURl + empId;
  const response = await fetch(url);
  const monthlySales = await response.json();
  return monthlySales;

}


let _employeeDataCache = null;
let filteredEmployeeData = null;

_employeeDataCache = await fetchEmpInfo(employeeDataURL);
filteredEmployeeData = filterEmployeeData();


const prompt = "tell me the name of my top distributor and how much sales he has done in the last month. also, tell me how much more sales does he have in percentage as compared to the second top distributor.";

const config = {
  tools: [
    {
      functionDeclarations: [fetchEmpInfo, filterEmployeeData],
    },
  ],
};
  
// const ai = new GoogleGenAI({ apiKey });
// const response = await ai.models.generateContentStream({
//   model: "gemini-2.5-flash",
//   contents: prompt,
//   // config : config,
// });

// let text = "";
// for await (const chunk of response) {
//   // console.log(chunk.text);
//   text += chunk.text;
// }

const topDistributors = getTopDistributors(10000009, 5);
console.log("Top Distributors for employee 10000009:", topDistributors);
// console.log(filteredEmployeeData[0]);


