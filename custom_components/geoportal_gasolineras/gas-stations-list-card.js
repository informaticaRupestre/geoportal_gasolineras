// gas-stations-list-card.js
// Compatible con todas las versiones recientes de Home Assistant
// Corrige el error "Uncaught (in promise)" en HACS

console.info(
  "%c⛽ Gas Stations List Card v1.0.2 loaded",
  "color: white; background: #ff9800; font-weight: bold; padding: 2px 6px; border-radius: 4px"
);

// Espera hasta que HA haya definido LitElement y html
function whenHaReady() {
  return new Promise((resolve) => {
    const check = () => {
      const Lit =
        window.LitElement ||
        (customElements.get("ha-panel-lovelace")
          ? Object.getPrototypeOf(customElements.get("ha-panel-lovelace"))
          : null);
      if (Lit && Lit.prototype && Lit.prototype.render) resolve(Lit);
      else setTimeout(check, 50);
    };
    check();
  });
}

whenHaReady().then((LitBase) => {
  const { html, css } = LitBase.prototype.constructor;

  class GasStationsListCard extends LitBase {
    static get properties() {
      return {
        hass: {},
        _config: {},
        _items: { state: true },
        _sortBy: { state: true },
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
      const list = [];
      for (const e of this._config.entities) {
        const st = this._hass.states[e.entity];
        if (!st) continue;
        const gasList = st.attributes.gasolineras || [];
        for (const g of gasList) {
          list.push({
            ...g,
            entity: e.entity,
            color: e.color || "#4CAF50",
            icon: e.icon || "mdi:gas-station",
          });
        }
      }
      this._items = this._sortItems(list, this._sortBy);
    }

    _sortItems(arr, by) {
      const items = [...arr];
      return by === "price"
        ? items.sort((a, b) => (a.precio ?? 999) - (b.precio ?? 999))
        : items.sort(
            (a, b) => (a.distancia_km ?? 999) - (b.distancia_km ?? 999)
          );
    }

    _onChangeSort(ev) {
      this._sortBy = ev.target.value;
      this._items = this._sortItems(this._items, this._sortBy);
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
                        <div class="name">${g.nombre ?? "Gasolinera"}</div>
                        <div class="meta">
                          💰 ${g.precio ?? "-"} €/L · 🧭 ${g.distancia_km ?? "-"} km
                        </div>
                      </div>
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
        .empty {
          padding: 16px;
          opacity: 0.6;
          text-align: center;
        }
      `;
    }
  }

  // Editor mínimo para compatibilidad visual
  class GasStationsListCardEditor extends LitBase {
    setConfig(config) {
      this._config = config;
    }
    render() {
      return html`
        <div style="padding:8px;">
          <ha-form
            .schema=${[
              {
                name: "entities",
                selector: { entity: { domain: "sensor", multiple: true } },
              },
              {
                name: "max_height",
                selector: { number: { min: 100, max: 1000, unit_of_measurement: "px" } },
              },
            ]}
            .data=${this._config}
            @value-changed=${(ev) =>
              this.dispatchEvent(
                new CustomEvent("config-changed", {
                  detail: { config: ev.detail.value },
                })
              )}
          ></ha-form>
        </div>
      `;
    }
  }

  customElements.define("gas-stations-list-card", GasStationsListCard);
  customElements.define("gas-stations-list-card-editor", GasStationsListCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "gas-stations-list-card",
    name: "Gas Stations List Card",
    description:
      "Lista de gasolineras con ordenación, colores, iconos y editor visual.",
  });
});
