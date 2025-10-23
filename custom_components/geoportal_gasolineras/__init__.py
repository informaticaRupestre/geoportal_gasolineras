"""Integración Geoportal Gasolineras - Inicialización."""

import logging
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.exceptions import ConfigEntryNotReady

from .const import DOMAIN
from .api import get_estaciones_por_provincia

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict):
    """Configuración inicial del componente."""
    _LOGGER.debug("Inicializando integración Geoportal Gasolineras (setup base)")
    return True




async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Configuración cuando se añade desde la UI."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = entry.data

    # Log para debugging
    _LOGGER.info(f"Configurando entrada: {entry.data}")

    modo = entry.data.get("modo", "provincia")

    if modo == "provincia":
        provincia_id = entry.data.get("provincia_id")
        if not provincia_id:
            _LOGGER.error("No se encontró provincia_id en la configuración")
            return False

        # Verificar que podemos conectar con la API
        try:
            _LOGGER.debug(f"Verificando API para provincia ID: {provincia_id}")
            estaciones = await hass.async_add_executor_job(
                get_estaciones_por_provincia, provincia_id
            )
            _LOGGER.info(f"API respondió con {len(estaciones)} estaciones")

        except Exception as err:
            _LOGGER.exception("Error al conectar con la API durante setup_entry")
            raise ConfigEntryNotReady(f"Fallo al conectar con la API: {err}") from err
    # Reenviar a la plataforma de sensores
    await hass.config_entries.async_forward_entry_setups(entry, ["sensor"])
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Limpieza al eliminar la integración."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, ["sensor"])
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok