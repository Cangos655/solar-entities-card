// solar-entities-card.js
// Custom Lovelace Card for Home Assistant
// Displays solar power entities: PV, Strings, Battery, House consumption

const CARD_VERSION = '1.1.0';

// ─── MAIN CARD ────────────────────────────────────────────────────────────────

class SolarEntitiesCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass  = null;
    this._config = {};
  }

  static getConfigElement() {
    return document.createElement('solar-entities-card-editor');
  }

  static getStubConfig() {
    return {
      title:              'Haus',
      entity_pv:          '',
      entity_string1:     '',
      entity_string2:     '',
      entity_battery_soc: '',
      entity_battery_power:'',
      entity_house:       '',
      entity_daily_yield: '',
      max_pv:             6000,
      max_string:         4000,
      max_house:          3000,
      max_battery:        5000,
    };
  }

  setConfig(config) {
    this._config = {
      title:               'Haus',
      max_pv:              6000,
      max_string:          4000,
      max_house:           3000,
      max_battery:         5000,
      ...config,
    };
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  // ── helper: get state object ──────────────────────────────────────────────
  _s(entityId) {
    if (!entityId || !this._hass) return null;
    return this._hass.states[entityId] || null;
  }

  // ── helper: parse numeric value from state ────────────────────────────────
  _num(entityId) {
    const s = this._s(entityId);
    if (!s || s.state === 'unavailable' || s.state === 'unknown') return null;
    const n = parseFloat(s.state);
    return isNaN(n) ? null : n;
  }

  // ── helper: format number for display ────────────────────────────────────
  _fmt(val, unit) {
    if (val === null) return '–';
    if (unit === '%')   return val.toFixed(1).replace('.', ',');
    if (unit === 'kWh') return val.toFixed(2).replace('.', ',');
    return Math.round(val).toLocaleString('de-DE');
  }

  // ── fire hass-more-info event ─────────────────────────────────────────────
  _moreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail:   { entityId },
      bubbles:  true,
      composed: true,
    }));
  }

  // ── build battery SVG ────────────────────────────────────────────────────
  _batterySvg(socPct, batColor) {
    const innerH = 82;
    const fillH  = Math.max(0, Math.min(socPct / 100, 1)) * innerH;
    const fillY  = (93 - fillH).toFixed(1);
    const pctTxt = Math.round(socPct) + '%';
    // Text at y=57; fill covers it when fillH > 36 (≈44% SOC) → white on color, else dark on background
    const textFill = fillH > 36 ? '#fff' : 'var(--primary-text-color, #1c1c1e)';

    return `
      <svg viewBox="0 0 52 96" xmlns="http://www.w3.org/2000/svg" style="width:48px;display:block">
        <defs>
          <clipPath id="sec-bat-clip">
            <rect x="3" y="11" width="46" height="82" rx="9"/>
          </clipPath>
        </defs>
        <rect x="17" y="0" width="18" height="12" rx="4"
          fill="var(--divider-color, #e5e5ea)"/>
        <rect x="1" y="10" width="50" height="84" rx="11"
          fill="none"
          stroke="var(--divider-color, #e5e5ea)" stroke-width="2.5"/>
        <rect x="3" y="11" width="46" height="82" rx="9"
          fill="var(--secondary-background-color, #f5f5f7)"/>
        <rect x="3" y="${fillY}" width="46" height="${fillH.toFixed(1)}" rx="9"
          fill="${batColor}"
          clip-path="url(#sec-bat-clip)"/>
        <text x="26" y="57"
          text-anchor="middle" dominant-baseline="middle"
          font-family="var(--paper-font-body1_-_font-family, system-ui, sans-serif)"
          font-size="12" font-weight="700"
          fill="${textFill}">${pctTxt}</text>
      </svg>`;
  }

  // ── main render ───────────────────────────────────────────────────────────
  _render() {
    if (!this._hass || !this._config) return;
    const c = this._config;

    // read values
    const pvVal    = this._num(c.entity_pv)           ?? 0;
    const s1Val    = this._num(c.entity_string1)       ?? 0;
    const s2Val    = this._num(c.entity_string2)       ?? 0;
    const socVal   = this._num(c.entity_battery_soc)   ?? 0;
    const batPow   = this._num(c.entity_battery_power) ?? 0;
    const houseVal = this._num(c.entity_house)         ?? 0;
    const yieldVal = this._num(c.entity_daily_yield);

    const pvFrac = pvVal / (c.max_pv || 6000);
    const s1Frac = s1Val / (c.max_string || 4000);
    const s2Frac = s2Val / (c.max_string || 4000);

    // battery color
    const batSocColor = socVal >= 40 ? '#34c759' : socVal >= 20 ? '#ffd60a' : '#ff3b30';
    const batCapPct   = Math.max(0, Math.min(socVal, 100)).toFixed(0);

    // battery power display
    // negative = discharging, positive = charging
    let batArrow = '⚡', batPowColor = 'var(--secondary-text-color, #8e8e93)', batStatus = 'Standby';
    if (batPow < -10) {
      batArrow = '↑'; batPowColor = '#ff3b30'; batStatus = 'Entlädt';
    } else if (batPow > 10) {
      batArrow = '↓'; batPowColor = '#34c759'; batStatus = 'Lädt';
    }
    const batPowDisplay = Math.abs(Math.round(batPow)).toLocaleString('de-DE');
    const batPillBg     = batPow < -10 ? 'rgba(255,59,48,0.08)' : batPow > 10 ? 'rgba(52,199,89,0.09)' : 'var(--secondary-background-color, #f2f2f7)';

    // yield header
    const yieldHtml = yieldVal !== null
      ? `<div class="header-yield ${c.entity_daily_yield ? 'clickable' : ''}"
            ${c.entity_daily_yield ? `data-entity="${c.entity_daily_yield}"` : ''}>
          <span class="yield-icon">☀️</span>
          <span class="yield-num">${this._fmt(yieldVal, 'kWh')} kWh</span>
          <span class="yield-lbl">heute</span>
        </div>`
      : '';

    const houseFrac   = houseVal / (c.max_house || 3000);
    const pvBarH      = (Math.min(pvFrac, 1) * 100).toFixed(1);
    const houseBarH   = (Math.min(houseFrac, 1) * 100).toFixed(1);
    const batSvg      = this._batterySvg(socVal, batSocColor);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .card {
          background: var(--card-background-color, #fff);
          border-radius: 20px;
          padding: 18px 18px 16px;
          font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
          color: var(--primary-text-color, #1c1c1e);
        }

        /* HEADER */
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
          padding: 0 2px;
        }
        .header-title {
          display: flex; align-items: center; gap: 7px;
        }
        .header-title-icon {
          width: 26px; height: 26px;
          background: var(--secondary-background-color, #f2f2f7);
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px;
        }
        .header-title-text {
          font-size: 15px; font-weight: 600;
          letter-spacing: -0.2px;
        }
        .header-yield {
          display: flex; align-items: center; gap: 5px;
          background: var(--secondary-background-color, #f2f2f7);
          border-radius: 10px; padding: 5px 9px;
        }
        .header-yield.clickable {
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .header-yield.clickable:hover  { opacity: 0.7; }
        .header-yield.clickable:active { opacity: 0.5; }
        .yield-icon  { font-size: 12px; }
        .yield-num   { font-size: 13px; font-weight: 700; letter-spacing: -0.2px; }
        .yield-lbl   { font-size: 10px; color: var(--secondary-text-color, #8e8e93); }

        /* GRID */
        .card-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        /* TILE BASE */
        .tile {
          background: var(--secondary-background-color, rgba(120,120,128,0.08));
          border: 1px solid var(--divider-color, rgba(128,128,128,0.12));
          border-radius: 16px;
          overflow: hidden;
          transition: opacity 0.15s, transform 0.12s;
        }
        .tile.clickable { cursor: pointer; }
        .tile.clickable:hover  { opacity: 0.82; }
        .tile.clickable:active { transform: scale(0.97); }

        /* PV + HOUSE TILES – vertical bar style */
        .tile-pv, .tile-house {
          display: flex;
          align-items: stretch;
          padding: 14px 14px 14px 12px;
          gap: 12px;
          min-height: 110px;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .tile-pv:active, .tile-house:active { opacity: 0.7; }

        .vbar-wrap {
          width: 10px;
          flex-shrink: 0;
          background: rgba(120,120,128,0.15);
          border-radius: 5px;
          position: relative;
          overflow: hidden;
          align-self: stretch;
        }
        .vbar-fill {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          border-radius: 5px;
          transition: height 0.5s cubic-bezier(.4,0,.2,1);
        }
        .stat-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .stat-lbl {
          font-size: 10px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.6px;
          color: var(--secondary-text-color, #8e8e93);
        }
        .stat-num {
          font-size: 36px; font-weight: 800;
          letter-spacing: -1.5px; line-height: 1;
        }
        .stat-unit {
          font-size: 11px; font-weight: 400;
          color: var(--secondary-text-color, #8e8e93);
          margin-top: 1px;
        }
        .stat-strings {
          font-size: 10px;
          color: var(--secondary-text-color, #8e8e93);
          opacity: 0.7;
          margin-top: 4px;
        }
        .stat-strings span {
          cursor: pointer;
          border-radius: 4px;
          padding: 1px 3px;
          transition: background 0.15s;
        }
        .stat-strings span:hover { background: rgba(48,209,88,0.1); }

        /* BATTERY TILE */
        .tile-battery {
          grid-column: span 2;
          display: flex; align-items: center;
          padding: 16px 18px; gap: 20px;
        }
        .bat-divider {
          width: 1px; align-self: stretch;
          background: var(--divider-color, rgba(0,0,0,0.05));
          margin: 4px 0; flex-shrink: 0;
        }
        .bat-info {
          flex: 1; display: flex; flex-direction: column; gap: 10px;
        }
        .bat-info-title {
          font-size: 10px; font-weight: 500;
          color: var(--secondary-text-color, #aeaeb2);
          text-transform: uppercase; letter-spacing: 0.3px;
          margin-bottom: 3px;
        }
        .bat-soc-row {
          display: flex; align-items: baseline; gap: 4px;
        }
        .bat-soc-num  { font-size: 34px; font-weight: 800; letter-spacing: -1px; line-height: 1; }
        .bat-soc-unit { font-size: 14px; color: var(--secondary-text-color, #8e8e93); }
        .bat-cap-bar  {
          height: 3px; background: rgba(120,120,128,0.2);
          border-radius: 2px; overflow: hidden;
        }
        .bat-cap-fill { height: 100%; border-radius: 2px; }
        .bat-power-row { display: flex; align-items: center; gap: 8px; }
        .bat-soc-click.clickable { cursor: pointer; border-radius: 8px; transition: opacity 0.15s; }
        .bat-soc-click.clickable:hover  { opacity: 0.7; }
        .bat-soc-click.clickable:active { opacity: 0.45; }
        .bat-power-pill {
          display: flex; align-items: center; gap: 5px;
          border-radius: 20px; padding: 5px 10px;
        }
        .bat-arrow  { font-size: 13px; line-height: 1; }
        .bat-pow-num { font-size: 15px; font-weight: 700; letter-spacing: -0.3px; line-height: 1; }
        .bat-pow-unit { font-size: 11px; color: var(--secondary-text-color, #8e8e93); }
        .bat-status {
          font-size: 11px; font-weight: 500;
          text-transform: uppercase; letter-spacing: 0.5px;
        }

        /* EMPTY STATE */
        .empty-state {
          text-align: center;
          padding: 32px 20px;
          color: var(--secondary-text-color, #8e8e93);
          font-size: 13px;
          line-height: 1.6;
        }
        .empty-state .icon { font-size: 32px; display: block; margin-bottom: 10px; }
      </style>

      <div class="card">

        <div class="card-header">
          <div class="header-title">
            <div class="header-title-icon">🏠</div>
            <div class="header-title-text">${c.title || 'Haus'}</div>
          </div>
          ${yieldHtml}
        </div>

        ${!c.entity_pv && !c.entity_battery_soc ? `
          <div class="empty-state">
            <span class="icon">☀️</span>
            Solar Entities Card<br>
            <small>Bitte Sensoren konfigurieren</small>
          </div>
        ` : `
        <div class="card-grid">

          <!-- PV + STRINGS -->
          <div class="tile tile-pv" data-entity="${c.entity_pv || ''}">
            <div class="vbar-wrap">
              <div class="vbar-fill" style="height:${pvBarH}%;background:#34c759"></div>
            </div>
            <div class="stat-content">
              <div class="stat-lbl">PV</div>
              <div>
                <div class="stat-num" style="color:#34c759">${this._fmt(pvVal, 'W')}</div>
                <div class="stat-unit">Watt</div>
                <div class="stat-strings">
                  <span data-entity="${c.entity_string1 || ''}">S1 ${this._fmt(s1Val, 'W')} W</span>
                  &nbsp;·&nbsp;
                  <span data-entity="${c.entity_string2 || ''}">S2 ${this._fmt(s2Val, 'W')} W</span>
                </div>
              </div>
            </div>
          </div>

          <!-- HAUSVERBRAUCH -->
          <div class="tile tile-house" data-entity="${c.entity_house || ''}">
            <div class="vbar-wrap">
              <div class="vbar-fill" style="height:${houseBarH}%;background:#ff3b30"></div>
            </div>
            <div class="stat-content">
              <div class="stat-lbl">Verbrauch</div>
              <div>
                <div class="stat-num" style="color:#ff3b30">${this._fmt(houseVal, 'W')}</div>
                <div class="stat-unit">Watt</div>
              </div>
            </div>
          </div>

          <!-- BATTERIE (full width) -->
          <div class="tile tile-battery">
            <div class="bat-soc-click clickable" data-entity="${c.entity_battery_soc || ''}">
              ${batSvg}
            </div>
            <div class="bat-divider"></div>
            <div class="bat-info">
              <div class="bat-soc-click clickable" data-entity="${c.entity_battery_soc || ''}">
                <div class="bat-info-title">Speicher</div>
                <div class="bat-soc-row">
                  <div class="bat-soc-num">${this._fmt(socVal, '%')}</div>
                  <div class="bat-soc-unit">%</div>
                </div>
              </div>
              <div class="bat-cap-bar bat-soc-click clickable" data-entity="${c.entity_battery_soc || ''}">
                <div class="bat-cap-fill" style="width:${batCapPct}%;background:${batSocColor}"></div>
              </div>
              <div class="bat-power-row">
                <div class="bat-power-pill clickable" style="background:${batPillBg}" data-entity="${c.entity_battery_power || ''}">
                  <span class="bat-arrow" style="color:${batPowColor}">${batArrow}</span>
                  <span class="bat-pow-num" style="color:${batPowColor}">${batPowDisplay}</span>
                  <span class="bat-pow-unit">W</span>
                </div>
                <span class="bat-status clickable" style="color:${batPowColor}" data-entity="${c.entity_battery_power || ''}">${batStatus}</span>
              </div>
            </div>
          </div>

        </div>
        `}
      </div>
    `;

    this._attachListeners();
  }

  _attachListeners() {
    // yield chip in header
    const yieldChip = this.shadowRoot.querySelector('.header-yield.clickable');
    if (yieldChip) {
      yieldChip.addEventListener('click', () => this._moreInfo(this._config.entity_daily_yield));
    }

    // PV tile
    const pvTile = this.shadowRoot.querySelector('.tile-pv[data-entity]');
    if (pvTile) {
      pvTile.addEventListener('click', e => {
        // string spans handle their own click; tile click fires on the tile itself
        if (!e.target.closest('.stat-strings span[data-entity]')) {
          this._moreInfo(pvTile.dataset.entity);
        }
      });
    }

    // String spans inside PV tile
    this.shadowRoot.querySelectorAll('.stat-strings span[data-entity]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        this._moreInfo(el.dataset.entity);
      });
    });

    // House tile
    const houseTile = this.shadowRoot.querySelector('.tile-house[data-entity]');
    if (houseTile) {
      houseTile.addEventListener('click', () => this._moreInfo(houseTile.dataset.entity));
    }

    // Battery: SOC areas and power pill/status (each has own data-entity)
    this.shadowRoot.querySelectorAll('.bat-soc-click[data-entity], .bat-power-pill[data-entity], .bat-status[data-entity]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        this._moreInfo(el.dataset.entity);
      });
    });
  }

  getCardSize() { return 4; }
}

// ─── EDITOR ───────────────────────────────────────────────────────────────────

const EDITOR_SCHEMA = [
  { name: 'title',                label: 'Titel',                          selector: { text: {} } },
  { name: 'entity_pv',            label: 'PV Gesamtleistung',              selector: { entity: { domain: 'sensor' } } },
  { name: 'entity_string1',       label: 'String 1 Leistung',              selector: { entity: { domain: 'sensor' } } },
  { name: 'entity_string2',       label: 'String 2 Leistung',              selector: { entity: { domain: 'sensor' } } },
  { name: 'entity_battery_soc',   label: 'Speicher Ladestand (%)',         selector: { entity: { domain: 'sensor' } } },
  { name: 'entity_battery_power', label: 'Speicher Leistung +/− (W)',      selector: { entity: { domain: 'sensor' } } },
  { name: 'entity_house',         label: 'Hausverbrauch (W)',              selector: { entity: { domain: 'sensor' } } },
  { name: 'entity_daily_yield',   label: 'PV Tagesertrag (kWh)',           selector: { entity: { domain: 'sensor' } } },
  { name: 'max_pv',               label: 'Max. PV Leistung (W)',           selector: { number: { min: 1000, max: 20000, step: 500, mode: 'box', unit_of_measurement: 'W' } } },
  { name: 'max_string',           label: 'Max. String Leistung (W)',       selector: { number: { min: 500,  max: 10000, step: 500, mode: 'box', unit_of_measurement: 'W' } } },
  { name: 'max_house',            label: 'Max. Hausverbrauch (W)',         selector: { number: { min: 500,  max: 10000, step: 500, mode: 'box', unit_of_measurement: 'W' } } },
  { name: 'max_battery',          label: 'Max. Speicher Leistung (W)',     selector: { number: { min: 500,  max: 20000, step: 500, mode: 'box', unit_of_measurement: 'W' } } },
];

class SolarEntitiesCardEditor extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config      = {};
    this._hass        = null;
    this._initialized = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  setConfig(config) {
    this._config = config || {};
    if (this._form) this._form.data = this._config;
    if (!this._initialized) this._initialize();
  }

  connectedCallback() {
    if (!this._initialized) this._initialize();
  }

  _initialize() {
    this._initialized = true;
    const form = document.createElement('ha-form');
    form.schema        = EDITOR_SCHEMA;
    form.data          = this._config;
    form.hass          = this._hass;
    form.computeLabel  = s => s.label || s.name;
    form.addEventListener('value-changed', e => {
      this._config = e.detail.value;
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail:  { config: this._config },
        bubbles: true, composed: true,
      }));
    });
    this._form = form;
    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(form);
  }
}

// ─── REGISTRATION ─────────────────────────────────────────────────────────────

customElements.define('solar-entities-card',        SolarEntitiesCard);
customElements.define('solar-entities-card-editor', SolarEntitiesCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        'solar-entities-card',
  name:        'Solar Entities Card',
  description: 'PV, Strings, Speicher und Hausverbrauch als elegante Übersichtskarte.',
  preview:     false,
});

console.info(`%c SOLAR-ENTITIES-CARD %c v${CARD_VERSION} `, 'background:#34c759;color:#000;font-weight:700;', 'background:#1c1c1e;color:#34c759;font-weight:700;');
