import requests
## This file contains apis for getting data from the suprsales API ONLY
import asyncio
import json

def get_employee_data(data="all"):
  """
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
  """
  url = "https://suprsales.in:5032/suprsales_api/Dashboard/employee"
  try:
    response = requests.get(url, headers={"Accept": "application/json"}, timeout=15)
    response.raise_for_status()
  except requests.RequestException:
    return [] if data == "id" else []

  # Safely parse JSON; handle empty/non-JSON bodies gracefully
  try:
    payload = response.json()
  except ValueError:
    import json
    text = response.text.strip()
    if not text:
      return [] if data == "id" else []
    try:
      payload = json.loads(text)
    except Exception:
      return [] if data == "id" else []

  if data == "all":
    return payload
  elif data == "id":
    return [x['EMP_ID'] for x in payload if isinstance(x, dict) and 'EMP_ID' in x]



def get_distributor_data():
  """
  This function is used to get the distributor data from the API.
  The distributor data is a list of IDs.
  The distributor id is the id of the distributor in the database.
  The distributor data is returned in a list of dictionaries.
  """
  sample_distributor_ids = [10001520, 10001519, 10001507, 10001515]


  return sample_distributor_ids


def get_distributor_performance(distributor_id, mode):
  """
  This function is used to get the details of customers from the API for a particular distributor.
  The api returns a list of dictionaries, each containing the TOTAL_SALES, CUSTOMER_ID and the CUSTOMER_NAME.
  """
  response = requests.get(f"https://suprsales.in:5032/suprsales_api/Dashboard/topDistributor?id={distributor_id}")
  response = response.json()

  # print(type(response[0]))
  print(response[0])
  response.sort(key=lambda x: x['TOTAL_SALES'])
  print(response[0])


# get_customer_data(10001515, "top")
print(get_employee_data("id"))