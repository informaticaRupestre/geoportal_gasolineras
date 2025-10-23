"""Cliente API para obtener datos del Ministerio de Energía."""
import logging

import requests
_LOGGER = logging.getLogger(__name__)

from .const import PROVINCIAS_ENDPOINT, ESTACIONES_ENDPOINT,TODAS_GASOLINERAS_ENDPOINT

def get_provincias():
    """Devuelve el listado de provincias."""
    _LOGGER.debug(f"Obteniendo provincias de: {PROVINCIAS_ENDPOINT}")
    response = requests.get(PROVINCIAS_ENDPOINT, timeout=15, verify=False)
    response.raise_for_status()
    return response.json()

def get_estaciones_por_provincia(id_provincia: str) -> list:
    """Devuelve todas las estaciones de servicio de una provincia."""
    url = f"{ESTACIONES_ENDPOINT}{id_provincia}"
    _LOGGER.debug(f"Obteniendo estaciones de: {url}")

    try:
        response = requests.get(url, timeout=20, verify=False)
        response.raise_for_status()
        data = response.json()

        # Log the structure for debugging
        _LOGGER.debug(f"Respuesta recibida con keys: {list(data.keys())}")

        estaciones = data.get("ListaEESSPrecio", [])
        _LOGGER.info(f"Encontradas {len(estaciones)} estaciones para provincia {id_provincia}")

        return estaciones
    except Exception as e:
        _LOGGER.error(f"Error al obtener estaciones: {e}")
        raise
def get_estaciones_todas():
    """Obtiene todas las estaciones de servicio de España."""
    _LOGGER.debug(f"Obteniendo todas las estaciones de: {TODAS_GASOLINERAS_ENDPOINT}")
    response = requests.get(TODAS_GASOLINERAS_ENDPOINT, timeout=30, verify=False)
    response.raise_for_status()
    data = response.json()
    estaciones = data.get("ListaEESSPrecio", [])
    _LOGGER.info(f"Encontradas {len(estaciones)} estaciones en total")
    return estaciones