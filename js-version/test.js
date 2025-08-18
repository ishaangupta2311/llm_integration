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

const ai = new GoogleGenAI({ apiKey });

async function get_employee_data(mode){
  /*
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
  url = "https://suprsales.in:5032/suprsales_api/Employee/index"
  try{
    response = await fetch(url, headers={"Accept": "application/json"}, timeout=15);
    response = response.json();
    

  }catch(e){
    console.error("Error fetching employee data:", e);
    return [];
  }

}
async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Explain how AI works in a few words",
  });
  console.log(response.text);
}

main();
