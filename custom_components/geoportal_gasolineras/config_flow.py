"""Flujo de configuración para Geoportal Gasolineras."""

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_LATITUDE, CONF_LONGITUDE, CONF_NAME
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, get_provincias_map


class GeoportalgasolinerasConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Maneja el flujo de configuración de la integración."""

    VERSION = 2

    async def async_step_user(self, user_input=None) -> FlowResult:
        """Primer paso: elegir el modo."""
        if user_input is not None:
            modo = user_input["modo"]
            if modo == "Provincia":
                return await self.async_step_provincia()
            elif modo == "Coordenadas":
                return await self.async_step_coordenadas()

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
        """Configuración por provincia (modo clásico)."""
        errors = {}

        if user_input is not None:
            provincias_map = await self.hass.async_add_executor_job(get_provincias_map)
            provincia_id = provincias_map[user_input["provincia"]]

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
    # 📍 MODO COORDENADAS
    # ---------------------------------------------------------------------

    async def async_step_coordenadas(self, user_input=None) -> FlowResult:
        """Configuración por coordenadas (modo gasolineras cercanas)."""
        errors = {}

        if user_input is not None:
            # Si el usuario eligió zona, usar sus coordenadas
            lat = user_input.get(CONF_LATITUDE)
            lon = user_input.get(CONF_LONGITUDE)
            if not lat or not lon:
                zone = user_input.get("zona")
                if zone and (ent := self.hass.states.get(zone)):
                    lat = ent.attributes.get("latitude")
                    lon = ent.attributes.get("longitude")

            if not lat or not lon:
                errors["base"] = "missing_coordinates"
            else:
                return self.async_create_entry(
                    title=f"Gasolineras cercanas ({lat:.3f}, {lon:.3f})",
                    data={
                        "modo": "coordenadas",
                        "latitud": lat,
                        "longitud": lon,
                        "radio_km": user_input["radio_km"],
                        "producto": user_input["producto"],
                        "zona": user_input.get("zona"),
                    },
                )

        zones = [
            (e.entity_id, e.name)
            for e in self.hass.states.async_all("zone")
        ]

        schema = vol.Schema(
            {
                vol.Optional("zona"): vol.In(dict(zones)) if zones else str,
                vol.Optional(CONF_LATITUDE, default=self.hass.config.latitude): cv.latitude,
                vol.Optional(CONF_LONGITUDE, default=self.hass.config.longitude): cv.longitude,
                vol.Optional("radio_km", default=25): vol.All(vol.Coerce(int), vol.Range(min=1, max=100)),
                vol.Optional("producto", default="Gasóleo A"): vol.In(
                    ["Gasolina 95 E5", "Gasolina 98 E5", "Gasóleo A", "Gasóleo Premium"]
                ),
            }
        )

        return self.async_show_form(step_id="coordenadas", data_schema=schema, errors=errors)
