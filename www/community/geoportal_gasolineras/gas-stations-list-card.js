/**
 * Gas Stations List Card — v4.5
 * Lista de gasolineras con scroll interno, orden dinámico y
 * apertura de mapas (Google / Apple / Waze según dispositivo).
 */

(() => {
    const CARD_TYPE = "gas-stations-list-card";
    if (customElements.get(CARD_TYPE)) return;

    class GasStationsListCard extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this.sortMode = "distancia";
        }

        setConfig(config) {
            if (!config?.entity)
                throw new Error("Debes definir la entidad del sensor con las gasolineras.");

            this.config = config;
            this.maxHeight = config.max_height || "380px";

            this.shadowRoot.innerHTML = `
        <style>
          :host { display:block; contain:content; }
          ha-card {
            display:flex; flex-direction:column;
            overflow:hidden; position:relative; contain:layout paint;
          }
          .header {
            display:flex; justify-content:space-between; align-items:center;
            padding:12px 16px; border-bottom:1px solid var(--divider-color,#ddd);
            background:var(--card-background-color); position:sticky; top:0; z-index:2;
          }
          .title { font-weight:600; font-size:18px; color:var(--primary-text-color); }
          select {
            background:var(--secondary-background-color,#f0f0f0);
            color:var(--primary-text-color);
            border:1px solid var(--divider-color,#ccc);
            border-radius:6px; font-size:13px;
            padding:4px 8px; cursor:pointer; outline:none;
          }
          select:hover { border-color:var(--primary-color); }
          .list-container {
            flex:1; overflow-y:auto; max-height:${this.maxHeight};
            padding:12px 16px 16px;
          }
          .item {
            padding:12px; margin-bottom:12px; border-radius:8px;
            background:var(--secondary-background-color,#f5f5f5);
            border-left:4px solid var(--primary-color);
            transition:transform .2s ease, box-shadow .2s ease;
          }
          .item:hover { transform:translateX(4px); box-shadow:0 2px 6px rgba(0,0,0,0.15); }
          .name { font-weight:700; color:var(--primary-color); font-size:16px; }
          .address { font-size:13px; color:var(--secondary-text-color); margin:4px 0 8px; }
          .details { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; }
          .price { font-size:20px; font-weight:700; color:#4CAF50; }
          .distance {
            background:var(--primary-color); color:#fff;
            padding:4px 10px; border-radius:12px;
            font-size:12px; cursor:pointer; text-decoration:none;
          }
          .distance:hover { opacity:0.9; }
          .list-container::-webkit-scrollbar { width:8px; }
          .list-container::-webkit-scrollbar-thumb {
            background:var(--primary-color); border-radius:4px;
          }
        </style>

        <ha-card>
          <div class="header">
            <div class="title">⛽ Gasolineras Cercanas</div>
            <select id="sort-select">
              <option value="distancia">Por cercanía</option>
              <option value="precio">Por precio</option>
            </select>
          </div>
          <div id="list" class="list-container"></div>
        </ha-card>
      `;

            this.shadowRoot.getElementById("sort-select")
                .addEventListener("change", (ev) => {
                    this.sortMode = ev.target.value;
                    this._renderList();
                });
        }

        set hass(hass) {
            this._hass = hass;
            if (!this.config) return;

            const entity = hass.states[this.config.entity];
            if (!entity) {
                this._renderMsg("Entidad no encontrada");
                return;
            }

            const gas = entity.attributes?.gasolineras;
            if (!Array.isArray(gas) || gas.length === 0) {
                this._renderMsg("No hay datos disponibles");
                return;
            }

            this._gasData = gas;
            this._renderList();
        }

        _sortGasStations(gasolineras) {
            const sorted = [...gasolineras];
            if (this.sortMode === "precio") {
                sorted.sort((a, b) => parseFloat(a.precio) - parseFloat(b.precio));
            } else {
                sorted.sort((a, b) => parseFloat(a.distancia_km) - parseFloat(b.distancia_km));
            }
            return sorted;
        }

        _openMap(lat, lon) {
            const ua = navigator.userAgent || navigator.vendor || window.opera;

            if (/android/i.test(ua)) {
                // Android → abre el menú de apps compatibles (Maps, Waze, etc.)
                window.location.href = `geo:${lat},${lon}?q=${lat},${lon}`;
            } else if (/iPad|iPhone|iPod/.test(ua)) {
                // iOS → abre el selector de apps (Apple Maps, Google Maps, Waze)
                window.location.href = `maps://maps.apple.com/?q=${lat},${lon}`;
            } else {
                // Escritorio → Google Maps en nueva pestaña
                window.open(`https://www.google.com/maps?q=${lat},${lon}`, "_blank");
            }
        }

        _renderList() {
            const listEl = this.shadowRoot.getElementById("list");
            if (!this._gasData) {
                this._renderMsg("Sin datos");
                return;
            }

            const data = this._sortGasStations(this._gasData);
            listEl.innerHTML = data.map(
                (g, i) => `
        <div class="item" data-i="${i}">
          <div class="name">${g.nombre ?? "Gasolinera"}</div>
          <div class="address">${g.direccion ?? ""}${g.localidad ? ", " + g.localidad : ""}</div>
          <div class="details">
            <div class="price">${g.precio ?? "-"} &euro;/L</div>
            <div class="distance" data-lat="${g.latitud}" data-lon="${g.longitud}">
              📍 ${g.distancia_km ?? "-"} km
            </div>
          </div>
        </div>`
            ).join("");

            // Añade eventos al pulsar en la distancia
            listEl.querySelectorAll(".distance").forEach((btn) => {
                btn.addEventListener("click", (ev) => {
                    const lat = ev.currentTarget.dataset.lat;
                    const lon = ev.currentTarget.dataset.lon;
                    if (lat && lon) this._openMap(lat, lon);
                });
            });
        }

        _renderMsg(msg) {
            const listEl = this.shadowRoot.getElementById("list");
            listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--secondary-text-color)">
        ${msg}
      </div>`;
        }

        getCardSize() { return 5; }
    }

    customElements.define(CARD_TYPE, GasStationsListCard);
    window.customCards = window.customCards || [];
    window.customCards.push({
        type: CARD_TYPE,
        name: "Gas Stations List Card",
        description: "Lista de gasolineras con scroll, orden y apertura de mapas según dispositivo.",
    });
})();
