"""Constantes para la integración Geoportal Gasolineras."""

import requests


DOMAIN = "geoportal_gasolineras"
API_BASE = "https://energia.serviciosmin.gob.es/ServiciosRESTCarburantes/PreciosCarburantes"
TODAS_GASOLINERAS_ENDPOINT =  f"{API_BASE}/EstacionesTerrestres/"
PROVINCIAS_ENDPOINT = f"{API_BASE}/Listados/Provincias/"
ESTACIONES_ENDPOINT = f"{API_BASE}/EstacionesTerrestres/FiltroProvincia/"



def get_provincias_map() -> dict:
    """Devuelve un diccionario {nombre: ID} de provincias."""
    response = requests.get(PROVINCIAS_ENDPOINT, timeout=15)
    response.raise_for_status()
    data = response.json()

    # Aquí el JSON es una lista, no un diccionario
    # Ejemplo: [{"IDPovincia": 1, "Provincia": "Álava"}, {...}, ...]
    provincias_map = {prov["Provincia"]: prov["IDPovincia"] for prov in data}

    return provincias_map
