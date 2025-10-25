# ⛽ Geoportal Gasolineras

Integración personalizada para **Home Assistant** que obtiene información en tiempo real de las gasolineras de España desde el [Geoportal de Energía del Ministerio para la Transición Ecológica](https://geoportal.minetur.gob.es/RecargaCarburantes/), permitiendo visualizar los precios, distancias y estaciones más cercanas mediante sensores y una tarjeta Lovelace interactiva.

---

## 🧩 Características principales

- 🚗 **Dos modos de funcionamiento**:
  - **Por provincia:** muestra el total, la más barata y la lista de las gasolineras más económicas.
  - **Por coordenadas:** muestra las gasolineras dentro de un radio determinado desde tu ubicación o una zona de Home Assistant.
- 🗺️ **Tarjeta Lovelace personalizada** (`gas-stations-list-card.js`) con:
  - Listado ordenable por **distancia** o **precio**.
  - Integración con **Google Maps**, **Waze**, o mapa interno.
  - Scroll interno para listas largas.
- ⚙️ **Integración por UI (config_flow)**: no requiere editar `configuration.yaml`.
- 🔁 **Actualización automática** cada 4 h.

---

## ⚙️ Instalación

### 🪄 Opción 1: Instalar desde HACS (recomendada)

1. Abre **HACS → Integraciones → Menú (⋮) → Repositorios personalizados**  
2. Añade este repositorio:
   ```
   https://github.com/informaticaRupestre/geoportal_gasolineras
   ```
3. Categoría: `Integration`
4. Guarda y busca **Geoportal Gasolineras** en la lista de integraciones de HACS.  
5. Instálala y reinicia Home Assistant.

🧠 También puedes hacerlo directamente pulsando este botón:

[![Añadir a HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=informaticaRupestre&repository=geoportal_gasolineras&category=integration)

---

### 🧰 Opción 2: Instalación manual

1. Copia el contenido de este repositorio en tu instalación de Home Assistant:
   ```
   config/custom_components/geoportal_gasolineras/
   ```
2. Copia la tarjeta Lovelace a:
   ```
   config/www/community/geoportal_gasolineras/gas-stations-list-card.js
   ```
3. Reinicia Home Assistant.
4. Añade el recurso Lovelace:
   ```yaml
   resources:
     - url: /hacsfiles/geoportal_gasolineras/gas-stations-list-card.js
       type: module
   ```

---

## 🧩 Configuración

1. Ve a **Ajustes → Dispositivos y servicios → Añadir integración**  
2. Busca **Geoportal Gasolineras**
3. Elige el modo de configuración:

### 🗺️ Modo “Provincia”
- Selecciona la provincia y el tipo de carburante  
- Se crearán sensores como:
  - `sensor.total_estaciones_madrid`
  - `sensor.mas_barata_madrid_gasoleo_a`
  - `sensor.lista_baratas_madrid_gasoleo_a`
  - y 5 sensores individuales (`gasolinera_1_...` hasta `gasolinera_5_...`)

### 📍 Modo “Coordenadas”
- Define latitud, longitud y radio de búsqueda (en km)
- Obtendrás un sensor con las gasolineras más cercanas a esa posición

---

## 🖼️ Tarjeta Lovelace personalizada

Una vez instalada la tarjeta (`gas-stations-list-card.js`), añádela en tu dashboard:


---

## 📁 Estructura del proyecto

```
custom_components/geoportal_gasolineras/
│
├── __init__.py
├── api.py
├── config_flow.py
├── const.py
├── sensor.py
├── manifest.json
│
www/community/geoportal_gasolineras/
└── gas-stations-list-card.js
```

---

## 🧠 Entidades creadas

| Tipo | Nombre ejemplo | Descripción |
|------|-----------------|--------------|
| `sensor.total_estaciones_madrid` | Total estaciones - Madrid | Número total de estaciones |
| `sensor.mas_barata_madrid_gasoleo_a` | Más barata - Madrid (Gasóleo A) | Nombre y precio de la más barata |
| `sensor.lista_baratas_madrid_gasoleo_a` | Lista gasolineras baratas | Lista completa en atributos |
| `sensor.gasolineras_cercanas_gasoleo_a` | Gasolineras cercanas | Gasolineras dentro de un radio |

---

## 🧰 Dependencias

- `requests` (instalada automáticamente por Home Assistant)

---

## 🧾 Licencia

Este proyecto se distribuye bajo licencia [MIT](LICENSE).

---

## 👨‍💻 Autor

**Informatica Rupestre**  
Repositorio: [github.com/informaticaRupestre/geoportal_gasolineras](https://github.com/informaticaRupestre/geoportal_gasolineras)
