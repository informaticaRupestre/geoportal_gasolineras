
# 🗺️ Integración Geoportal Gasolineras para Home Assistant

Esta integración permite consultar los precios de las estaciones de servicio en España
gracias a los servicios REST públicos del **Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO)**.

Permite visualizar las gasolineras más baratas por provincia o las gasolineras más cercanas
a una ubicación determinada (según coordenadas y radio en kilómetros).

---

## 🚀 Características principales

- Datos actualizados directamente desde la API oficial del MITECO.
- Dos modos de funcionamiento:
  - **Por provincia:** muestra las estaciones de servicio de una provincia concreta.
  - **Por coordenadas:** muestra las gasolineras dentro de un radio determinado de una latitud/longitud.

[//]: # (- Cálculo automático de distancias &#40;Haversine&#41;.)
[//]: # (- Conversión de coordenadas con coma a punto decimal.)
- Sensor con listado de gasolineras, precios, direcciones y distancias.
- Sensor adicional con el número total de estaciones.
- Posibilidad de crear grupos automáticos de sensores.
- Compatible con tarjetas de tipo Markdown.

---

## 🧰 Instalación

### 📦 Método manual

1. Descarga el contenido del repositorio y copia la carpeta `geoportal_gasolineras`
   dentro del directorio `custom_components` de tu instalación de Home Assistant.
   La ruta final debe ser:

   ```bash
   /config/custom_components/geoportal_gasolineras/
   ```

2. Reinicia Home Assistant para que se detecte la nueva integración.

3. Añade la integración desde la interfaz de Home Assistant:
   - Ve a **Configuración → Dispositivos y servicios → Añadir integración**.
   - Busca **Geoportal Gasolineras**.

---

## ⚙️ Configuración

### 🔹 Modo Provincia

Permite obtener los datos de una provincia específica y un tipo de carburante.

- Selecciona una **provincia** del listado.
- Elige el **tipo de carburante** entre:
  - Gasolina 95 E5
  - Gasolina 98 E5
  - Gasóleo A
  - Gasóleo Premium

El sistema creará varios sensores automáticos, incluyendo:
- `sensor.total_estaciones_[provincia]`
- `sensor.gasolinera_barata_[provincia]_[producto]`
- `sensor.lista_gasolineras_baratas_[provincia]_[producto]`
- Sensores individuales para las 5 más baratas.

---

### 🔹 Modo Coordenadas

Permite definir una ubicación concreta mediante:
- **Latitud**
- **Longitud**
- **Radio (km)**
- **Tipo de carburante**

Se creará un sensor con las gasolineras dentro del radio indicado, con los siguientes atributos:

```yaml
gasolineras:
  - nombre: REPSOL
    direccion: AVENIDA CASTILLA, 12
    localidad: MADRID
    precio: 1.379
    latitud: 40.4168
    longitud: -3.7038
    distancia_km: 2.34
  - nombre: ...
```

---
## 🧾 Ejemplo de tarjeta Mapa o Lista

Para representar visualmente las gasolineras obtenidas por esta integración, puedes utilizar la tarjeta
[**Lovelace Gas Stations List Card**](https://github.com/informaticaRupestre/lovelace-gas-stations-list-card).

Esta tarjeta permite mostrar de forma clara las gasolineras más cercanas o las más baratas de una provincia,
usando la entidad generada por esta integración (`sensor.lista_gasolineras_baratas_*` o `sensor.gasolineras_cercanas_*`).

Ejemplo básico de uso:

```yaml
type: custom:gas-stations-list-card
entity: sensor.gasolineras_cercanas_madrid_gasoleo_a
title: ⛽ Gasolineras más cercanas
```

## 🧾 Ejemplo de tarjeta Markdown

Puedes mostrar los datos de la entidad directamente con una tarjeta de tipo Markdown:

```yaml
type: markdown
title: ⛽ Gasolineras cercanas
content: >-
  {% set g = state_attr('sensor.gasolineras_cercanas_*', 'gasolineras') %}
  {% if g is not none and (g | count) > 0 %}
  {% for e in g %}
  **{{ loop.index }}. {{ e.nombre }}**  
  📍 {{ e.localidad }} — {{ e.direccion }}  
  💰 **{{ e.precio }} €/L** — 🧭 {{ e.distancia_km }} km  
  
  
  {% endfor %}
  {% else %}
  ⚠️ No hay gasolineras para mostrar ahora mismo.
  {% endif %}
```

---

## 🧠 Créditos

Desarrollado por **@informaticaRupestre**  
Datos obtenidos del portal público del [Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO)](https://geoportalgasolineras.es/).

---

## 🪪 Licencia

Este proyecto está bajo una licencia personalizada basada en MIT.  
Se permite el uso personal, educativo y no comercial.  
El uso comercial del software está **prohibido sin autorización previa del autor**.  
Consulta el archivo [LICENSE](./LICENSE) para más detalles.