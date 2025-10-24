// gas-stations-list-card.js
// Custom card for Home Assistant: Gas Stations List Card
// - Visual editor (no YAML required)
// - Supports multiple sensor entities (sensor.gasolineras_cercanas_*)
// - Per-entity UI customization (name, icon, color)
// - In-card sorting (price / distance)
// - Max height with internal scroll
//
// Place this file at: /config/www/gas-stations-list-card.js
// Add to Lovelace resources:
//   url: /local/gas-stations-list-card.js
//   type: module

/* eslint no-console: 0 */
if (!customElements.get("gas-stations-list-card")) {
  const Lit = window.litElement || window.litHtml || window.LitElement;
}

const HELP_URL =
  "https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/";

const fireEvent = (node, type, detail, options) => {
  options = options || {};
  detail = detail === null || detail === undefined ? {} : detail;
  const event = new Event(type, {
    bubbles: options.bubbles === undefined ? true : options.bubbles,
    cancelable:
      options.cancelable === undefined ? false : options.cancelable,
    composed: options.composed === undefined ? true : options.composed,
  });
  event.detail = detail;
  node.dispatchEvent(event);
  return event;
};

const supportsFeature = (stateObj, feature) =>
  (stateObj.attributes.supported_features & feature) !== 0;

// --------------------
// LitElement imports
// --------------------
const { html, css } = window.litHtml || window.Lit || window.litElement || window.litElementHass || window.HADev
  ? window.litHtml || window.Lit?.html || window.litElement?.html
  : window.LitHtml || window.litHtml;

const LitElementBase =
  window.LitElement || window.litElement || Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));

const literalHtml = (strings, ...values) => html(strings, ...values);

// Fallbacks for older HA builds:
const HA_SELECT_TAG = "ha-select";
const HA_TEXTFIELD_TAG = "ha-textfield";
const HA_SWITCH_TAG = "ha-switch";
const HA_ICON_PICKER_TAG = "ha-icon-picker";
const HA_ENTITY_PICKER_TAG = "ha-entity-picker";

// --------------------
// Main Card
// --------------------
class GasStationsListCard extends (window.LitElement || LitElementBase) {
  static get properties() {
    return {
      hass: {},
      _config: {},
      _items: { state: true },
      _sortBy: { state: true },
      _expandedMenu: { state: true }, // track which item menu is open
    };
  }

  static getStubConfig(hass) {
    // Try to suggest one matching entity as a stub
    const anySensor =
      hass &&
      Object.keys(hass.states).find((e) =>
        e.startsWith("sensor.gasolineras_cercanas")
      );
    return {
      entities: anySensor
        ? [
            {
              entity: anySensor,
              name: "",
              icon: "mdi:gas-station",
              color: "#4CAF50",
            },
          ]
        : [],
      max_height: 380,
      initial_sort: "distance", // or "price"
    };
  }

  static getConfigElement() {
    return document.createElement("gas-stations-list-card-editor");
  }

  static get cardType() {
    return "gas-stations-list-card";
  }

  setConfig(config) {
    if (!config) throw new Error("Missing configuration");
    const defaults = {
      entities: [],
      max_height: 380,
      initial_sort: "distance",
    };
    this._config = { ...defaults, ...config };
    this._sortBy = this._config.initial_sort || "distance";
    this._expandedMenu = null;
    this._buildItems();
  }

  set hass(hass) {
    this.__hass = hass;
    this._buildItems();
    this.requestUpdate();
  }

  get hass() {
    return this.__hass;
  }

  getCardSize() {
    // approx number of rows
    return 4;
  }

  _buildItems() {
    if (!this.__hass || !this._config?.entities?.length) {
      this._items = [];
      return;
    }

    const merged = [];
    for (const e of this._config.entities) {
      if (!e?.entity) continue;
      const st = this.__hass.states[e.entity];
      if (!st) continue;

      const gasList = st.attributes?.gasolineras;
      if (Array.isArray(gasList)) {
        gasList.forEach((g, idx) => {
          // Normalize fields with safe fallbacks
          const item = {
            source: e.entity,
            sourceName: e.name || st.attributes.friendly_name || e.entity,
            icon: e.icon || "mdi:gas-station",
            color: e.color || "#4CAF50",
            nombre: g.nombre || g.name || "Gasolinera",
            precio:
              g.precio !== undefined
                ? Number(g.precio)
                : g.price !== undefined
                ? Number(g.price)
                : NaN,
            distancia_km:
              g.distancia_km !== undefined
                ? Number(g.distancia_km)
                : g.distance_km !== undefined
                ? Number(g.distance_km)
                : NaN,
            localidad: g.localidad || g.city || "",
            lat: g.latitud ?? g.lat ?? g.latitude ?? null,
            lon: g.longitud ?? g.lon ?? g.lng ?? g.longitude ?? null,
            raw: g,
            _key: `${e.entity}::${idx}`,
          };
          merged.push(item);
        });
      }
    }

    // initial sort
    this._items = this._sortItems(merged, this._sortBy);
  }

  _sortItems(arr, by) {
    const items = [...arr];
    if (by === "price") {
      items.sort((a, b) => {
        const ap = isNaN(a.precio) ? Number.POSITIVE_INFINITY : a.precio;
        const bp = isNaN(b.precio) ? Number.POSITIVE_INFINITY : b.precio;
        return ap - bp;
      });
    } else {
      // distance
      items.sort((a, b) => {
        const ad = isNaN(a.distancia_km)
          ? Number.POSITIVE_INFINITY
          : a.distancia_km;
        const bd = isNaN(b.distancia_km)
          ? Number.POSITIVE_INFINITY
          : b.distancia_km;
        return ad - bd;
      });
    }
    return items;
  }

  _onChangeSort(ev) {
    const val = ev.target.value || ev.detail?.value || "distance";
    this._sortBy = val;
    this._items = this._sortItems(this._items || [], val);
  }

  _toggleMenu(key) {
    this._expandedMenu = this._expandedMenu === key ? null : key;
  }

  _mapsLinks(item) {
    const { lat, lon } = item;
    if (lat == null || lon == null) return null;
    const dest = `${lat},${lon}`;

    return {
      google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        dest
      )}`,
      apple: `maps://?daddr=${encodeURIComponent(dest)}`,
      waze: `https://waze.com/ul?ll=${encodeURIComponent(
        dest
      )}&navigate=yes`,
      geo: `geo:${dest}`, // some Android apps handle this
    };
  }

  _row(item) {
    const links = this._mapsLinks(item);
    const key = item._key;
    const menuOpen = this._expandedMenu === key;

    return html`
      <div class="row" style=${this._rowBorderStyle(item.color)}>
        <div class="left">
          <ha-icon .icon=${item.icon} style=${`color:${item.color}`}></ha-icon>
        </div>
        <div class="mid">
          <div class="name">
            ${item.nombre}
            ${item.localidad ? html`<span class="city">· ${item.localidad}</span>` : ""}
          </div>
          <div class="meta">
            <span class="price">
              ${isNaN(item.precio) ? "—" : `${item.precio.toFixed(3)} €/L`}
            </span>
            <span class="dot">•</span>
            <span class="dist">
              ${isNaN(item.distancia_km) ? "—" : `${item.distancia_km.toFixed(2)} km`}
            </span>
            <span class="dot">•</span>
            <span class="source">${item.sourceName}</span>
          </div>
        </div>
        <div class="right">
          ${links
            ? html`
                <ha-button
                  class="navbtn"
                  @click=${() => this._toggleMenu(key)}
                >
                  Navegar
                </ha-button>
                ${menuOpen
                  ? html`
                      <div class="menu">
                        <a href=${links.google} target="_blank" rel="noreferrer">Google Maps</a>
                        <a href=${links.apple}>Apple Maps (iOS)</a>
                        <a href=${links.waze} target="_blank" rel="noreferrer">Waze</a>
                      </div>
                    `
                  : ""}
              `
            : html`<span class="no-loc">Sin coordenadas</span>`}
        </div>
      </div>
    `;
  }

  _rowBorderStyle(color) {
    return `border-left: 4px solid ${color || "#4CAF50"}`;
  }

  render() {
    if (!this._config) return html``;

    const maxH =
      typeof this._config.max_height === "number"
        ? `${this._config.max_height}px`
        : this._config.max_height || "380px";

    return html`
      <ha-card header="⛽ Gasolineras">
        <div class="toolbar">
          <div class="sort">
            <label for="sortSel">Ordenar por</label>
            <select id="sortSel" @change=${this._onChangeSort.bind(this)}>
              <option value="distance" ?selected=${this._sortBy === "distance"}>
                Distancia
              </option>
              <option value="price" ?selected=${this._sortBy === "price"}>
                Precio
              </option>
            </select>
          </div>
        </div>

        <div class="list" style="max-height:${maxH}">
          ${(!this._items || this._items.length === 0)
            ? html`<div class="empty">No hay datos para mostrar.</div>`
            : this._items.map((it) => this._row(it))}
        </div>

        <div class="footer">
          <span class="help"
            >Configura entidades y estilo desde el editor visual.</span
          >
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
      ha-card {
        overflow: hidden;
      }
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 8px 12px 0 12px;
      }
      .sort {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sort select {
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid var(--divider-color, #ddd);
        background: var(--card-background-color);
        color: var(--primary-text-color);
      }
      .list {
        overflow-y: auto;
        padding: 8px 6px 6px 6px;
      }
      .empty {
        padding: 16px;
        opacity: 0.7;
      }
      .row {
        display: grid;
        grid-template-columns: 40px 1fr auto;
        gap: 10px;
        align-items: center;
        padding: 10px 12px;
        background: var(--ha-card-background, var(--card-background-color));
        border-radius: 12px;
        margin: 6px 6px 10px 6px;
        box-shadow: var(--ha-card-box-shadow, 0 1px 2px rgba(0,0,0,0.08));
        position: relative;
      }
      .left ha-icon {
        width: 28px;
        height: 28px;
      }
      .name {
        font-weight: 600;
      }
      .city {
        font-weight: 400;
        opacity: 0.7;
        margin-left: 6px;
      }
      .meta {
        margin-top: 2px;
        font-size: 0.9em;
        opacity: 0.9;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .meta .dot {
        opacity: 0.5;
      }
      .right {
        position: relative;
      }
      .navbtn {
        --mdc-theme-primary: var(--primary-color);
        background: var(--primary-color);
        color: var(--text-primary-color, #fff);
        border: none;
        border-radius: 999px;
        padding: 6px 10px;
        cursor: pointer;
        font-size: 0.9em;
      }
      .navbtn:hover {
        filter: brightness(1.05);
      }
      .menu {
        position: absolute;
        right: 0;
        top: 36px;
        background: var(--card-background-color);
        border: 1px solid var(--divider-color, #ddd);
        border-radius: 10px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: 2;
        min-width: 170px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.15);
      }
      .menu a {
        text-decoration: none;
        color: var(--primary-text-color);
        padding: 6px 8px;
        border-radius: 6px;
      }
      .menu a:hover {
        background: rgba(0,0,0,0.06);
      }
      .no-loc {
        opacity: 0.6;
        font-size: 0.9em;
      }
      .footer {
        padding: 6px 12px 12px 12px;
        opacity: 0.6;
        font-size: 0.88em;
      }
    `;
  }
}

// --------------------
// Visual Editor
// --------------------
class GasStationsListCardEditor extends (window.LitElement || LitElementBase) {
  static get properties() {
    return {
      hass: {},
      _config: {},
      _entities: { state: true },
      _maxHeight: { state: true },
    };
  }

  setConfig(config) {
    const defaults = { entities: [], max_height: 380, initial_sort: "distance" };
    this._config = { ...defaults, ...config };
    this._entities = Array.isArray(this._config.entities)
      ? JSON.parse(JSON.stringify(this._config.entities))
      : [];
    this._maxHeight = this._config.max_height;
  }

  set hass(hass) {
    this.__hass = hass;
    this.requestUpdate();
  }

  get hass() {
    return this.__hass;
  }

  // ------ helpers ------
  _updateConfig() {
    const newConfig = {
      ...this._config,
      entities: this._entities,
      max_height: this._maxHeight,
    };
    this._config = newConfig;
    fireEvent(this, "config-changed", { config: newConfig });
  }

  _addEntity() {
    this._entities = [
      ...this._entities,
      {
        entity: "",
        name: "",
        icon: "mdi:gas-station",
        color: "#4CAF50",
      },
    ];
    this._updateConfig();
  }

  _removeEntity(idx) {
    const arr = [...this._entities];
    arr.splice(idx, 1);
    this._entities = arr;
    this._updateConfig();
  }

  _updateEntity(idx, key, value) {
    const arr = [...this._entities];
    arr[idx] = { ...arr[idx], [key]: value };
    this._entities = arr;
    this._updateConfig();
  }

  _renderEntityRow(e, idx) {
    const hass = this.__hass;
    return html`
      <div class="entity-row">
        <div class="col entity">
          <label>Entidad</label>
          <ha-entity-picker
            .hass=${hass}
            .value=${e.entity || ""}
            .includeDomains=${["sensor"]}
            @value-changed=${(ev) =>
              this._updateEntity(idx, "entity", ev.detail.value)}
          ></ha-entity-picker>
        </div>

        <div class="col name">
          <label>Nombre mostrado</label>
          <ha-textfield
            .value=${e.name || ""}
            @input=${(ev) => this._updateEntity(idx, "name", ev.target.value)}
            placeholder="(opcional)"
          ></ha-textfield>
        </div>

        <div class="col icon">
          <label>Icono</label>
          ${customElements.get("ha-icon-picker")
            ? html`<ha-icon-picker
                .hass=${hass}
                .value=${e.icon || "mdi:gas-station"}
                @value-changed=${(ev) =>
                  this._updateEntity(idx, "icon", ev.detail.value)}
              ></ha-icon-picker>`
            : html`<ha-textfield
                .value=${e.icon || "mdi:gas-station"}
                @input=${(ev) =>
                  this._updateEntity(idx, "icon", ev.target.value)}
                placeholder="mdi:gas-station"
              ></ha-textfield>`}
        </div>

        <div class="col color">
          <label>Color</label>
          <input
            type="color"
            .value=${e.color || "#4CAF50"}
            @input=${(ev) => this._updateEntity(idx, "color", ev.target.value)}
          />
        </div>

        <div class="col actions">
          <mwc-button
            class="danger"
            @click=${() => this._removeEntity(idx)}
            label="Eliminar"
          ></mwc-button>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="section">
          <div class="header">Entidades</div>
          ${(!this._entities || this._entities.length === 0)
            ? html`<div class="hint">Añade una o más entidades de tipo <code>sensor.gasolineras_cercanas_*</code>.</div>`
            : ""}
          ${this._entities.map((e, idx) => this._renderEntityRow(e, idx))}
          <mwc-button
            class="add"
            @click=${this._addEntity}
            label="Añadir entidad"
          ></mwc-button>
        </div>

        <div class="section">
          <div class="header">Visual</div>
          <div class="grid">
            <div class="col">
              <label>Altura máxima (px)</label>
              <ha-textfield
                .value=${String(this._maxHeight ?? "")}
                type="number"
                min="180"
                max="1200"
                step="10"
                @input=${(ev) =>
                  ((this._maxHeight = Number(ev.target.value) || 380),
                  this._updateConfig())}
              ></ha-textfield>
            </div>
          </div>
          <div class="small">
            La lista tendrá scroll interno cuando supere esta altura.
          </div>
        </div>

        <div class="section">
          <div class="header">Orden inicial</div>
          <div class="grid">
            <div class="col">
              <label>Orden</label>
              <select
                .value=${this._config.initial_sort || "distance"}
                @change=${(ev) => {
                  this._config = {
                    ...this._config,
                    initial_sort: ev.target.value,
                  };
                  this._updateConfig();
                }}
              >
                <option value="distance">Distancia</option>
                <option value="price">Precio</option>
              </select>
            </div>
          </div>
          <div class="small">
            El usuario podrá cambiar el orden dentro de la tarjeta.
          </div>
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      .wrapper {
        padding: 8px 4px 12px 4px;
      }
      .section {
        border: 1px solid var(--divider-color, #dcdcdc);
        border-radius: 12px;
        padding: 12px;
        margin: 10px 0;
        background: var(--card-background-color);
      }
      .header {
        font-weight: 700;
        margin-bottom: 10px;
      }
      .hint {
        opacity: 0.7;
        margin-bottom: 10px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit,minmax(220px,1fr));
        gap: 12px;
      }
      .entity-row {
        display: grid;
        grid-template-columns: 1.5fr 1.2fr 1fr 0.6fr auto;
        gap: 10px;
        align-items: end;
        margin: 8px 0;
        padding-bottom: 8px;
        border-bottom: 1px dashed var(--divider-color, #ddd);
      }
      .entity-row:last-child {
        border-bottom: none;
      }
      label {
        display: block;
        font-size: 0.9em;
        margin-bottom: 6px;
        opacity: 0.9;
      }
      mwc-button.add {
        --mdc-theme-primary: var(--primary-color);
        margin-top: 8px;
      }
      mwc-button.danger {
        --mdc-theme-primary: var(--error-color, #c62828);
      }
      .small {
        margin-top: 6px;
        font-size: 0.9em;
        opacity: 0.7;
      }
      select {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--divider-color,#ddd);
        background: var(--card-background-color);
        color: var(--primary-text-color);
      }
      ha-textfield {
        width: 100%;
      }
      input[type="color"] {
        width: 100%;
        height: 40px;
        padding: 0;
        border: none;
        background: transparent;
      }
      code {
        background: rgba(0,0,0,0.06);
        padding: 2px 6px;
        border-radius: 6px;
      }
    `;
  }
}

// --------------------
// Register elements
// --------------------

// Asegura que el editor se registra antes del getConfigElement
if (!customElements.get("gas-stations-list-card-editor")) {
  customElements.define(
    "gas-stations-list-card-editor",
    GasStationsListCardEditor
  );
}

if (!customElements.get("gas-stations-list-card")) {
  customElements.define("gas-stations-list-card", GasStationsListCard);
}

// Garantiza compatibilidad con Lovelace GUI
window.customCards = window.customCards || [];
window.customCards.push({
  type: "gas-stations-list-card",
  name: "Gas Stations List Card",
  description:
    "Muestra listas de gasolineras cercanas con ordenación y personalización visual.",
});

// Asegura que Home Assistant pueda instanciar el editor
GasStationsListCard.getConfigElement = function () {
  return document.createElement("gas-stations-list-card-editor");
};
GasStationsListCard.getStubConfig = function () {
  return {
    entities: [],
    max_height: 380,
    initial_sort: "distance",
  };
};


// --------------------
// Lovelace Catalogue entry (nice to have)
// --------------------
window.customCards = window.customCards || [];
window.customCards.push({
  type: "gas-stations-list-card",
  name: "Gas Stations List (Custom)",
  description:
    "Lista de gasolineras con orden por precio/distancia, editor visual y múltiples entidades.",
  preview: false,
  documentationURL: HELP_URL,
});
