import requests



def get_distributor_data():
  """
  This function is used to get the distributor data from the API.
  The distributor data is a list of IDs.
  The distributor id is the id of the distributor in the database.
  The distributor data is returned in a list of dictionaries.
  """
  sample_distributor_ids = [10001520, 10001519, 10001507, 10001515]


  return sample_distributor_ids

def get_customer_data(distributor_id):

  """
  This function is used to get the customer data from the API.
  The api returns a list of dictionaries, each containing the TOTAL_SALES, CUSTOMER_ID and the CUSTOMER_NAME.
  """

  response = requests.get(f"https://suprsales.in:5032/suprsales_api/Dashboard/topDistributor?id={distributor_id}")
  return response.json()

