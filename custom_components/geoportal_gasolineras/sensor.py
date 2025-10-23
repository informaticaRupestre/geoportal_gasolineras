"""Sensores de gasolineras por provincia."""

from __future__ import annotations

import logging
from datetime import timedelta
from homeassistant.components.sensor import SensorEntity
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.config_entries import ConfigEntry
from homeassistant.exceptions import ConfigEntryNotReady
from math import radians, sin, cos, sqrt, atan2


from .const import DOMAIN
from .api import get_estaciones_por_provincia, get_estaciones_todas

_LOGGER = logging.getLogger(__name__)
SCAN_INTERVAL = timedelta(hours=4)  # actualizar cada 4h

async def async_setup_entry_old(hass: HomeAssistant, entry, async_add_entities):
    """Configura los sensores con la provincia elegida."""
    provincia_id = entry.data.get("provincia_id")
    provincia_nombre = entry.data.get("provincia")
    producto = entry.data.get("producto")

    coordinator = GasolinerasCoordinator(hass, provincia_id)
    await coordinator.async_config_entry_first_refresh()

    # Sensores básicos
    sensores = [
        TotalEstacionesSensor(coordinator, provincia_nombre),
        GasolineraBarataSensor(coordinator, provincia_nombre, producto),
        ListaGasolinerasBaratasSensor(coordinator, provincia_nombre, producto),
        GasolinerasCercanasSensor(coordinator, "Madrid", 40.4168, -3.7038, 20, producto)
    ]

    # ✅ Crear 5 sensores individuales para cada gasolinera del top 5
    sensores_individuales = []
    for i in range(5):
        sensor = GasolineraIndividualSensor(coordinator, provincia_nombre, producto, i)
        sensores.append(sensor)
        sensores_individuales.append(f"sensor.gasolinera_{i + 1}_{provincia_nombre.lower().replace(' ', '_')}_{producto.lower().replace(' ', '_')}")



    async_add_entities(sensores)

    # ✅ Crear grupo automáticamente
    group_name = f"gasolineras_{provincia_nombre.lower().replace(' ', '_')}_{producto.lower().replace(' ', '_')}"
    await hass.services.async_call(
        "group",
        "set",
        {
            "object_id": group_name,
            "name": f"🗺️ Gasolineras {provincia_nombre} ({producto})",
            "entities": sensores_individuales,
        },
        blocking=True,
    )



async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback):
    """Configura los sensores según el modo (provincia o coordenadas)."""

    modo = entry.data.get("modo", "provincia")
    producto = entry.data.get("producto")

    sensores = []

    # ------------------------------------------------------------------
    # 🗺️ MODO PROVINCIA (actual)
    # ------------------------------------------------------------------
    if modo == "provincia":
        provincia_id = entry.data.get("provincia_id")
        provincia_nombre = entry.data.get("provincia")

        coordinator = GasolinerasCoordinator(hass, provincia_id)
        await coordinator.async_config_entry_first_refresh()

        sensores = [
            TotalEstacionesSensor(coordinator, provincia_nombre),
            GasolineraBarataSensor(coordinator, provincia_nombre, producto),
            ListaGasolinerasBaratasSensor(coordinator, provincia_nombre, producto),
        ]

        # ✅ Crear 5 sensores individuales (top 5)
        sensores_individuales = []
        for i in range(5):
            sensor = GasolineraIndividualSensor(coordinator, provincia_nombre, producto, i)
            sensores.append(sensor)
            sensores_individuales.append(
                f"sensor.gasolinera_{i + 1}_{provincia_nombre.lower().replace(' ', '_')}_{producto.lower().replace(' ', '_')}"
            )

        async_add_entities(sensores)

        # ✅ Crear grupo automáticamente
        group_name = f"gasolineras_{provincia_nombre.lower().replace(' ', '_')}_{producto.lower().replace(' ', '_')}"
        await hass.services.async_call(
            "group",
            "set",
            {
                "object_id": group_name,
                "name": f"🗺️ Gasolineras {provincia_nombre} ({producto})",
                "entities": sensores_individuales,
            },
            blocking=True,
        )

    # ------------------------------------------------------------------
    # 📍 MODO COORDENADAS (nuevo)
    # ------------------------------------------------------------------
    elif modo == "coordenadas":
        nombre = entry.title
        latitud = float(entry.data["latitud"])
        longitud = float(entry.data["longitud"])
        radio_km = int(entry.data.get("radio_km", 25))

        coordinator = GasolinerasCoordinator(hass, None)
        await coordinator.async_config_entry_first_refresh()

        sensores = [
            GasolinerasCercanasSensor(coordinator, nombre, latitud, longitud, radio_km, producto)
        ]

        async_add_entities(sensores)
class GasolinerasCoordinator(DataUpdateCoordinator):
    """Coordina la actualización de datos desde la API del Ministerio."""

    def __init__(self, hass, provincia_id=None):
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN}_coordinator",
            update_interval=timedelta(hours=1),
        )
        self.hass = hass
        self.provincia_id = provincia_id

    async def _async_update_data(self):
        """Actualiza los datos según el modo."""
        try:
            if self.provincia_id:
                _LOGGER.debug("Actualizando datos por provincia %s", self.provincia_id)
                return await self.hass.async_add_executor_job(get_estaciones_por_provincia, self.provincia_id)
            else:
                _LOGGER.debug("Actualizando datos de toda España (modo coordenadas)")
                return await self.hass.async_add_executor_job(get_estaciones_todas)
        except Exception as err:
            raise UpdateFailed(f"Error al obtener datos de la API: {err}") from err



class TotalEstacionesSensor(SensorEntity):
    """Sensor que muestra el número total de estaciones."""

    def __init__(self, coordinator, provincia):
        self.coordinator = coordinator
        self._attr_name = f"⛽ Total estaciones - {provincia}"
        self._attr_icon = "mdi:gas-station"
        self._attr_unique_id = f"total_estaciones_{provincia.lower().replace(' ', '_')}"

    @property
    def native_value(self):
        estaciones = self.coordinator.data or []
        return len(estaciones)

    async def async_update(self):
        await self.coordinator.async_request_refresh()


class GasolineraBarataSensor(SensorEntity):
    """Sensor que muestra la gasolinera más barata."""

    def __init__(self, coordinator, provincia, producto):
        self.coordinator = coordinator
        self.producto = producto
        self._attr_name = f"🏆 Más barata - {provincia} ({producto})"
        self._attr_icon = "mdi:currency-eur"
        self._attr_unique_id = f"mas_barata_{provincia.lower().replace(' ', '_')}_{producto.lower().replace(' ', '_')}"

    @property
    def native_value(self):
        estaciones = self.coordinator.data or []
        if not estaciones:
            return "Sin datos"

        # Buscar el campo de precio según producto
        campo_precio = self._get_campo_precio()

        # Filtrar estaciones que tengan precio válido
        estaciones_validas = [
            e for e in estaciones if e.get(campo_precio) and e.get(campo_precio) != ""
        ]

        if not estaciones_validas:
            return "Sin precio disponible"

        # Encontrar la más barata
        mas_barata = min(
            estaciones_validas,
            key=lambda e: float(e[campo_precio].replace(",", "."))
        )

        nombre = mas_barata.get("Rótulo", "Desconocido")
        precio = mas_barata.get(campo_precio, "?")
        localidad = mas_barata.get("Localidad", "Desconocido")

        return f"{nombre} - {precio} €/L ({localidad})"

    def _get_campo_precio(self):
        """Determina el campo de precio según el producto."""
        if "95" in self.producto:
            return "Precio Gasolina 95 E5"
        elif "98" in self.producto:
            return "Precio Gasolina 98 E5"
        elif "Premium" in self.producto:
            return "Precio Gasoleo Premium"
        else:
            return "Precio Gasoleo A"

    async def async_update(self):
        await self.coordinator.async_request_refresh()


class ListaGasolinerasBaratasSensor(SensorEntity):
    """Sensor que muestra una lista de las gasolineras más baratas."""

    def __init__(self, coordinator, provincia, producto):
        self.coordinator = coordinator
        self.provincia = provincia
        self.producto = producto
        self._attr_name = f"⛽ Lista gasolineras baratas - {provincia} ({producto})"
        self._attr_icon = "mdi:gas-station"
        self._attr_unique_id = f"lista_baratas_{provincia.lower().replace(' ', '_')}_{producto.lower().replace(' ', '_')}"

    @property
    def native_value(self):
        """Valor principal del sensor: el precio mínimo encontrado."""
        estaciones = self._get_estaciones_validas()
        if not estaciones:
            return "Sin datos"
        return estaciones[0]["precio"]

    @property
    def extra_state_attributes(self):
        """Lista de las 5 gasolineras más baratas con detalles."""
        estaciones = self._get_estaciones_validas()
        top = estaciones[:5]  # top 5
        return {
            "gasolineras": [
                {
                    "nombre": e["nombre"],
                    "precio": e["precio"],
                    "direccion": e.get("direccion"),
                    "localidad": e.get("localidad"),
                    "latitud": e.get("latitud"),
                    "longitud": e.get("longitud"),
                }
                for e in top
            ]
        }

    def _get_estaciones_validas(self):
        """Filtra y ordena estaciones por precio."""
        estaciones = self.coordinator.data or []

        # Determinar campo de precio según producto
        campo_precio = self._get_campo_precio()

        estaciones_validas = []
        for e in estaciones:
            valor = e.get(campo_precio)
            if not valor:
                continue
            try:
                precio = float(valor.replace(",", "."))
            except ValueError:
                continue

            estaciones_validas.append(
                {
                    "nombre": e.get("Rótulo", "Desconocido"),
                    "direccion": e.get("Dirección", "N/A"),
                    "localidad": e.get("Localidad", "N/A"),
                    "precio": precio,
                    "latitud": self._safe_float(e.get("Latitud")),
                    "longitud": self._safe_float(e.get("Longitud (WGS84)")),
                }
            )

        estaciones_validas.sort(key=lambda x: x["precio"])
        return estaciones_validas

    def _get_campo_precio(self):
        """Determina el campo de precio según el producto."""
        if "95" in self.producto:
            return "Precio Gasolina 95 E5"
        elif "98" in self.producto:
            return "Precio Gasolina 98 E5"
        elif "Premium" in self.producto:
            return "Precio Gasoleo Premium"
        else:
            return "Precio Gasoleo A"

    def _safe_float(self, value):
        """Convierte texto con coma decimal a float."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        try:
            return float(str(value).replace(",", "."))
        except (ValueError, TypeError):
            return None


# ✅ NUEVO: Sensor individual para cada gasolinera del top 5
class GasolineraIndividualSensor(SensorEntity):
    """Sensor individual para mostrar cada gasolinera en el mapa."""

    def __init__(self, coordinator, provincia, producto, index):
        self.coordinator = coordinator
        self.provincia = provincia
        self.producto = producto
        self.index = index
        self._attr_name = f"⛽ Gasolinera #{index + 1} - {provincia} ({producto})"
        self._attr_icon = "mdi:gas-station"
        self._attr_unique_id = f"gasolinera_{index + 1}_{provincia.lower().replace(' ', '_')}_{producto.lower().replace(' ', '_')}"

    @property
    def native_value(self):
        """Precio de esta gasolinera."""
        estaciones = self._get_estaciones_validas()
        if len(estaciones) <= self.index:
            return "unavailable"
        return estaciones[self.index]["precio"]

    @property
    def extra_state_attributes(self):
        """Atributos incluyendo latitude y longitude para el mapa."""
        estaciones = self._get_estaciones_validas()
        if len(estaciones) <= self.index:
            return {}

        e = estaciones[self.index]
        return {
            "latitude": e.get("latitud"),  # ✅ Clave estándar de Home Assistant
            "longitude": e.get("longitud"),  # ✅ Clave estándar de Home Assistant
            "nombre": e["nombre"],
            "direccion": e.get("direccion"),
            "localidad": e.get("localidad"),
            "precio": e["precio"],
        }

    def _get_estaciones_validas(self):
        """Filtra y ordena estaciones por precio."""
        estaciones = self.coordinator.data or []
        campo_precio = self._get_campo_precio()

        estaciones_validas = []
        for e in estaciones:
            valor = e.get(campo_precio)
            if not valor:
                continue
            try:
                precio = float(valor.replace(",", "."))
            except ValueError:
                continue

            estaciones_validas.append(
                {
                    "nombre": e.get("Rótulo", "Desconocido"),
                    "direccion": e.get("Dirección", "N/A"),
                    "localidad": e.get("Localidad", "N/A"),
                    "precio": precio,
                    "latitud": self._safe_float(e.get("Latitud")),
                    "longitud": self._safe_float(e.get("Longitud (WGS84)")),
                }
            )

        estaciones_validas.sort(key=lambda x: x["precio"])
        return estaciones_validas

    def _get_campo_precio(self):
        """Determina el campo de precio según el producto."""
        if "95" in self.producto:
            return "Precio Gasolina 95 E5"
        elif "98" in self.producto:
            return "Precio Gasolina 98 E5"
        elif "Premium" in self.producto:
            return "Precio Gasoleo Premium"
        else:
            return "Precio Gasoleo A"

    def _safe_float(self, value):
        """Convierte texto con coma decimal a float."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        try:
            return float(str(value).replace(",", "."))
        except (ValueError, TypeError):
            return None

    async def async_update(self):
        await self.coordinator.async_request_refresh()




class GasolinerasCercanasSensor(SensorEntity):
    """Sensor que muestra las gasolineras dentro de un radio determinado."""

    def __init__(self, coordinator, nombre, latitud_centro, longitud_centro, radio_km, producto):
        self.coordinator = coordinator
        self._attr_name = f"⛽ Gasolineras cercanas - {nombre} ({producto})"
        self._attr_icon = "mdi:map-marker-distance"
        self.lat_centro = latitud_centro
        self.lon_centro = longitud_centro
        self.radio_km = radio_km
        self.producto = producto

    @property
    def native_value(self):
        """Número de gasolineras encontradas dentro del radio."""
        gasolineras = self._get_gasolineras_en_radio()
        return len(gasolineras)

    @property
    def extra_state_attributes(self):
        """Devuelve la lista de gasolineras dentro del radio."""
        gasolineras = self._get_gasolineras_en_radio()
        # Ordenar por distancia ascendente y devolver solo las 10 más cercanas
        gasolineras = sorted(gasolineras, key=lambda x: x["distancia_km"])[:50]
        return {"gasolineras": gasolineras}

    def _get_gasolineras_en_radio(self):
        """Filtra las gasolineras dentro del radio especificado."""
        estaciones = self.coordinator.data or []

        if "95" in self.producto:
            campo_precio = "Precio Gasolina 95 E5"
        elif "98" in self.producto:
            campo_precio = "Precio Gasolina 98 E5"
        elif "Premium" in self.producto:
            campo_precio = "Precio Gasoleo Premium"
        else:
            campo_precio = "Precio Gasoleo A"

        gasolineras_cercanas = []
        for e in estaciones:
            try:
                lat = self._safe_float(e.get("Latitud"))
                lon = self._safe_float(e.get("Longitud (WGS84)"))
                precio = self._safe_float(e.get(campo_precio))
            except (ValueError, TypeError):
                continue

            if lat is None or lon is None:
                continue

            distancia = self._haversine(self.lat_centro, self.lon_centro, lat, lon)
            if distancia <= self.radio_km:
                gasolineras_cercanas.append(
                    {
                        "nombre": e.get("Rótulo", "Desconocido"),
                        "direccion": e.get("Dirección", "N/A"),
                        "localidad": e.get("Localidad", "N/A"),
                        "precio": precio,
                        "latitud": lat,
                        "longitud": lon,
                        "distancia_km": round(distancia, 2),
                    }
                )

        return gasolineras_cercanas

    def _haversine(self, lat1, lon1, lat2, lon2):
        """Devuelve la distancia en km entre dos coordenadas."""
        R = 6371
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c

    def _safe_float(self, value):
        """Convierte texto con coma decimal a float."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        try:
            return float(str(value).replace(",", "."))
        except (ValueError, TypeError):
            return None
