// gas-stations-list-card.js
// Custom Card for Home Assistant: Gas Stations List Card
// Compatible con instalación manual o HACS
// Desarrollado para Geoportal Gasolineras
// -----------------------------------------------------------

console.info(
  `%c🚗 Gas Stations List Card %cVersion 1.0.1`,
  "color: white; background: #ff9800; font-weight: bold; padding: 2px 4px; border-radius: 4px 0 0 4px;",
  "color: white; background: #555; font-weight: bold; padding: 2px 4px; border-radius: 0 4px 4px 0;"
);

// Helper para eventos
const fireEvent = (node, type, detail = {}, options = {}) => {
  const event = new Event(type, {
    bubbles: options.bubbles ?? true,
    cancelable: options.cancelable ?? false,
    composed: options.composed ?? true,
  });
  event.detail = detail;
  node.dispatchEvent(event);
};

// Asegurar compatibilidad con distintas versiones de HA
const LitElementClass =
  window.LitElement ||
  Object.getPrototypeOf(customElements.get("ha-panel-lovelace")) ||
  Object.getPrototypeOf(customElements.get("hui-view"));

const { html, css } = LitElementClass.prototype.constructor;

// -----------------------------------------------------------
// MAIN CARD
// -----------------------------------------------------------
class GasStationsListCard extends LitElementClass {
  static get properties() {
    return {
      hass: {},
      _config: {},
      _items: { state: true },
      _sortBy: { state: true },
      _expandedMenu: { state: true },
    };
  }

  static getConfigElement() {
    return document.createElement("gas-stations-list-card-editor");
  }

  static getStubConfig(hass) {
    const entity = hass
      ? Object.keys(hass.states).find((e) =>
          e.startsWith("sensor.gasolineras_cercanas")
        )
      : undefined;
    return {
      entities: entity
        ? [
            {
              entity,
              name: "Gasolineras",
              icon: "mdi:gas-station",
              color: "#4CAF50",
            },
          ]
        : [],
      max_height: 400,
      initial_sort: "distance",
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Falta configuración");
    const defaults = {
      entities: [],
      max_height: 400,
      initial_sort: "distance",
    };
    this._config = { ...defaults, ...config };
    this._sortBy = this._config.initial_sort;
    this._expandedMenu = null;
    this._buildItems();
  }

  set hass(hass) {
    this._hass = hass;
    this._buildItems();
  }

  get hass() {
    return this._hass;
  }

  _buildItems() {
    if (!this._hass || !this._config?.entities?.length) {
      this._items = [];
      return;
    }
    const arr = [];
    for (const e of this._config.entities) {
      const st = this._hass.states[e.entity];
      if (!st) continue;
      const gasList = st.attributes.gasolineras || [];
      for (const g of gasList) {
        arr.push({
          ...g,
          source: e.entity,
          name: e.name || st.attributes.friendly_name,
          icon: e.icon || "mdi:gas-station",
          color: e.color || "#4CAF50",
        });
      }
    }
    this._items = this._sortItems(arr, this._sortBy);
  }

  _sortItems(arr, mode) {
    const list = [...arr];
    if (mode === "price")
      list.sort((a, b) => (a.precio ?? 999) - (b.precio ?? 999));
    else
      list.sort((a, b) => (a.distancia_km ?? 999) - (b.distancia_km ?? 999));
    return list;
  }

  _onChangeSort(ev) {
    this._sortBy = ev.target.value;
    this._items = this._sortItems(this._items, this._sortBy);
  }

  _mapsLinks(item) {
    if (!item.latitud && !item.lat) return null;
    const lat = item.latitud ?? item.lat;
    const lon = item.longitud ?? item.lon;
    const dest = `${lat},${lon}`;
    return {
      google: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
      waze: `https://waze.com/ul?ll=${dest}&navigate=yes`,
      apple: `maps://?daddr=${dest}`,
    };
  }

  render() {
    if (!this._config) return html``;
    const maxH =
      typeof this._config.max_height === "number"
        ? `${this._config.max_height}px`
        : this._config.max_height;
    return html`
      <ha-card header="⛽ Gasolineras">
        <div class="toolbar">
          <label>Ordenar por:</label>
          <select @change=${this._onChangeSort.bind(this)}>
            <option value="distance" ?selected=${this._sortBy === "distance"}>Distancia</option>
            <option value="price" ?selected=${this._sortBy === "price"}>Precio</option>
          </select>
        </div>
        <div class="list" style="max-height:${maxH}">
          ${this._items?.length
            ? this._items.map(
                (g) => html`
                  <div class="row" style="border-left:4px solid ${g.color}">
                    <ha-icon .icon=${g.icon}></ha-icon>
                    <div class="info">
                      <div class="name">${g.nombre || "Gasolinera"}</div>
                      <div class="meta">
                        💰 ${g.precio ?? "-"} €/L · 🧭 ${g.distancia_km ?? "-"} km
                      </div>
                    </div>
                    ${this._mapsLinks(g)
                      ? html`
                          <a
                            class="nav"
                            href=${this._mapsLinks(g).google}
                            target="_blank"
                            >🗺️</a
                          >
                        `
                      : ""}
                  </div>
                `
              )
            : html`<div class="empty">No hay datos disponibles.</div>`}
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      ha-card {
        padding: 8px;
      }
      .toolbar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
      }
      .list {
        overflow-y: auto;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--card-background-color);
        border-radius: 8px;
        padding: 8px 10px;
        margin-bottom: 6px;
        box-shadow: var(--ha-card-box-shadow);
      }
      .info {
        flex: 1;
      }
      .name {
        font-weight: 600;
      }
      .meta {
        font-size: 0.9em;
        opacity: 0.8;
      }
      .nav {
        text-decoration: none;
        font-size: 1.2em;
      }
      .empty {
        padding: 16px;
        opacity: 0.6;
        text-align: center;
      }
    `;
  }
}

// -----------------------------------------------------------
// VISUAL EDITOR
// -----------------------------------------------------------
class GasStationsListCardEditor extends LitElementClass {
  static get properties() {
    return {
      hass: {},
      _config: {},
    };
  }

  setConfig(config) {
    this._config = config;
  }

  render() {
    if (!this.hass) return html``;
    const entities = this._config?.entities || [];
    return html`
      <div class="editor">
        <h4>Entidades</h4>
        ${entities.map(
          (e, i) => html`
            <div class="row">
              <ha-entity-picker
                .hass=${this.hass}
                .value=${e.entity}
                .includeDomains=${["sensor"]}
                @value-changed=${(ev) =>
                  this._updateEntity(i, "entity", ev.detail.value)}
              ></ha-entity-picker>
              <ha-textfield
                .value=${e.name || ""}
                label="Nombre"
                @input=${(ev) => this._updateEntity(i, "name", ev.target.value)}
              ></ha-textfield>
              <input
                type="color"
                .value=${e.color || "#4CAF50"}
                @input=${(ev) => this._updateEntity(i, "color", ev.target.value)}
              />
              <mwc-button @click=${() => this._removeEntity(i)}>🗑️</mwc-button>
            </div>
          `
        )}
        <mwc-button @click=${this._addEntity}>➕ Añadir entidad</mwc-button>
        <h4>Altura máxima</h4>
        <ha-textfield
          type="number"
          .value=${this._config?.max_height || 400}
          @input=${(ev) => this._set("max_height", ev.target.value)}
        ></ha-textfield>
      </div>
    `;
  }

  _updateEntity(i, key, val) {
    const arr = [...(this._config.entities || [])];
    arr[i] = { ...arr[i], [key]: val };
    this._set("entities", arr);
  }

  _removeEntity(i) {
    const arr = [...(this._config.entities || [])];
    arr.splice(i, 1);
    this._set("entities", arr);
  }

  _addEntity() {
    const arr = [...(this._config.entities || [])];
    arr.push({ entity: "", name: "", color: "#4CAF50" });
    this._set("entities", arr);
  }

  _set(key, val) {
    const newConfig = { ...this._config, [key]: val };
    fireEvent(this, "config-changed", { config: newConfig });
  }

  static get styles() {
    return css`
      .editor {
        padding: 8px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }
      input[type="color"] {
        width: 40px;
        height: 36px;
        border: none;
      }
    `;
  }
}

// -----------------------------------------------------------
// REGISTRO GLOBAL
// -----------------------------------------------------------
customElements.define("gas-stations-list-card", GasStationsListCard);
customElements.define("gas-stations-list-card-editor", GasStationsListCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "gas-stations-list-card",
  name: "Gas Stations List Card",
  description:
    "Lista de gasolineras con ordenación, colores, iconos y editor visual.",
});
