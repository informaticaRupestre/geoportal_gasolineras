"""Flujo de configuración para Geoportal Gasolineras."""

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_LATITUDE, CONF_LONGITUDE
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, get_provincias_map

import logging

_LOGGER = logging.getLogger(__name__)


class GeoportalGasolinerasConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Maneja el flujo de configuración de la integración Geoportal Gasolineras."""

    VERSION = 3

    def __init__(self):
        """Inicializar el flujo."""
        self.config_data = {}

    async def async_step_user(self, user_input=None) -> FlowResult:
        """Primer paso: elegir el modo de configuración."""
        if user_input is not None:
            modo = user_input["modo"]
            if modo == "Provincia":
                return await self.async_step_provincia()
            elif modo == "Coordenadas":
                # Guardamos que el modo es coordenadas
                self.config_data["modo"] = "coordenadas"
                return await self.async_step_combustible()

        schema = vol.Schema(
            {
                vol.Required("modo", default="Provincia"): vol.In(["Provincia", "Coordenadas"])
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    # ---------------------------------------------------------------------
    # 🗺️ MODO PROVINCIA
    # ---------------------------------------------------------------------

    async def async_step_provincia(self, user_input=None) -> FlowResult:
        """Configuración por provincia."""
        errors = {}

        if user_input is not None:
            try:
                provincias_map = await self.hass.async_add_executor_job(get_provincias_map)
                provincia_id = provincias_map[user_input["provincia"]]
            except Exception as err:
                _LOGGER.exception("Error al obtener provincias: %s", err)
                errors["base"] = "fetch_failed"
                provincias_map = {}

            if not errors:
                return self.async_create_entry(
                    title=f"Gasolineras - {user_input['provincia']}",
                    data={
                        "modo": "provincia",
                        "provincia": user_input["provincia"],
                        "provincia_id": provincia_id,
                        "producto": user_input["producto"],
                    },
                )

        provincias_map = await self.hass.async_add_executor_job(get_provincias_map)

        schema = vol.Schema(
            {
                vol.Required("provincia"): vol.In(list(provincias_map.keys())),
                vol.Optional("producto", default="Gasolina 95 E5"): vol.In(
                    ["Gasolina 95 E5", "Gasolina 98 E5", "Gasóleo A", "Gasóleo Premium"]
                ),
            }
        )

        return self.async_show_form(step_id="provincia", data_schema=schema, errors=errors)

    # ---------------------------------------------------------------------
    # 📍 MODO COORDENADAS - PASO 1: COMBUSTIBLE
    # ---------------------------------------------------------------------

    async def async_step_combustible(self, user_input=None) -> FlowResult:
        """Primer paso coordenadas: seleccionar tipo de combustible."""
        if user_input is not None:
            self.config_data["producto"] = user_input["producto"]
            return await self.async_step_coordenadas()

        schema = vol.Schema(
            {
                vol.Required("producto", default="Gasóleo A"): vol.In(
                    ["Gasolina 95 E5", "Gasolina 98 E5", "Gasóleo A", "Gasóleo Premium"]
                ),
            }
        )

        return self.async_show_form(
            step_id="combustible",
            data_schema=schema,
            description_placeholders={"step": "1/3"}
        )

    # ---------------------------------------------------------------------
    # 📍 MODO COORDENADAS - PASO 2: ZONA/COORDENADAS Y RADIO
    # ---------------------------------------------------------------------

    async def async_step_coordenadas(self, user_input=None) -> FlowResult:
        """Segundo paso: elegir zona o manual + radio (sin mostrar coordenadas aún)."""
        errors = {}

        if user_input is not None:
            _LOGGER.debug(f"Datos recibidos en paso coordenadas: {user_input}")

            zone_entity_id = user_input.get("zona")
            radio = user_input.get("radio_km", 25)
            lat = None
            lon = None

            # Si eligió una zona, obtener sus coordenadas
            if zone_entity_id and zone_entity_id != "manual":
                zone_state = self.hass.states.get(zone_entity_id)
                if zone_state:
                    lat = zone_state.attributes.get("latitude")
                    lon = zone_state.attributes.get("longitude")
                    self.config_data["zona_nombre"] = zone_state.name
                    _LOGGER.debug(f"Zona seleccionada {zone_entity_id}: lat={lat}, lon={lon}")
                else:
                    errors["zona"] = "zone_not_found"
            else:
                # Si eligió manual, usamos las coordenadas de Home Assistant por defecto
                lat = self.hass.config.latitude
                lon = self.hass.config.longitude
                self.config_data["zona_nombre"] = "Personalizada"

            # Validar que tenemos coordenadas
            if lat is None or lon is None:
                errors["base"] = "missing_coordinates"

            if not errors:
                # Guardar datos temporales y pasar a confirmación
                self.config_data.update({
                    "latitud": lat,
                    "longitud": lon,
                    "radio_km": radio,
                    "zona_entity_id": zone_entity_id if zone_entity_id != "manual" else None,
                })
                return await self.async_step_confirmar()

        # Obtener zonas del sistema
        zones = {e.entity_id: e.name for e in self.hass.states.async_all("zone")}

        # Añadir opción "manual" al principio
        zone_options = {"manual": "🖊️ Introducir coordenadas manualmente"}
        zone_options.update(zones)

        schema = vol.Schema(
            {
                vol.Required("zona", default="manual"): vol.In(zone_options),
                vol.Required("radio_km", default=25): vol.All(
                    vol.Coerce(int),
                    vol.Range(min=1, max=100)
                ),
            }
        )

        return self.async_show_form(
            step_id="coordenadas",
            data_schema=schema,
            errors=errors,
            description_placeholders={
                "step": "2/3",
                "producto": self.config_data.get("producto", "Gasóleo A")
            }
        )
    # ---------------------------------------------------------------------
    # 📍 MODO COORDENADAS - PASO 3: CONFIRMAR
    # ---------------------------------------------------------------------

    async def async_step_confirmar(self, user_input=None) -> FlowResult:
        """Tercer paso: confirmar y ajustar coordenadas finales."""

        if user_input is not None:
            # Crear la entrada final con los datos confirmados
            lat = float(user_input["latitud"])
            lon = float(user_input["longitud"])
            radio = int(user_input["radio_km"])

            zona_nombre = self.config_data.get("zona_nombre", "Personalizada")
            title = f"Gasolineras - {zona_nombre} ({lat:.3f}, {lon:.3f})"

            return self.async_create_entry(
                title=title,
                data={
                    "modo": "coordenadas",
                    "latitud": lat,
                    "longitud": lon,
                    "radio_km": radio,
                    "producto": self.config_data["producto"],
                    "zona": self.config_data.get("zona_entity_id"),
                },
            )

        # Mostrar formulario de confirmación con valores actuales
        lat = self.config_data["latitud"]
        lon = self.config_data["longitud"]
        radio = self.config_data["radio_km"]
        zona_nombre = self.config_data.get("zona_nombre", "Personalizada")

        schema = vol.Schema(
            {
                vol.Required("latitud", default=lat): cv.latitude,
                vol.Required("longitud", default=lon): cv.longitude,
                vol.Required("radio_km", default=radio): vol.All(
                    vol.Coerce(int),
                    vol.Range(min=1, max=100)
                ),
            }
        )

        return self.async_show_form(
            step_id="confirmar",
            data_schema=schema,
            description_placeholders={
                "step": "3/3",
                "zona": zona_nombre,
                "lat": f"{lat:.6f}",
                "lon": f"{lon:.6f}",
                "radio": radio,
                "producto": self.config_data["producto"]
            }
        )