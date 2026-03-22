// solar-entities-card.js
// Custom Lovelace Card for Home Assistant
// Displays solar power entities: PV, Strings, Battery, House consumption

const CARD_VERSION = '1.0.0';

// ─── SVG RING HELPERS ─────────────────────────────────────────────────────────

// Full 270° track arc path (gap at bottom)
// Uses stroke-dasharray on a circle: 75% filled = 270°, 25% gap = 90°
function ringDashArray(r, fraction) {
  const C      = 2 * Math.PI * r;
  const arc270 = C * 0.75;
  const filled = Math.max(0, Math.min(fraction, 1)) * arc270;
  const empty  = C - filled;
  return { filled: filled.toFixed(2), empty: empty.toFixed(2), track: arc270.toFixed(2), gap: (C * 0.25).toFixed(2) };
}

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

  // ── build SVG ring (270° Apple-Watch style) ───────────────────────────────
  _ringsvg(r, fraction, color, trackColor, valueText, unitText, vbSize) {
    const cx = vbSize / 2;
    const cy = vbSize / 2;
    const sw = vbSize * 0.076;
    const da = ringDashArray(r, fraction);

    const valSize  = vbSize === 120 ? 19 : 16;
    const unitSize = vbSize === 120 ? 9  : 8;
    const valY     = cy - 2;
    const unitY    = cy + valSize * 0.75;

    return `
      <svg viewBox="0 0 ${vbSize} ${vbSize}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${cx}" cy="${cy}" r="${r}"
          fill="none" stroke="${trackColor}"
          stroke-width="${sw}" stroke-linecap="round"
          stroke-dasharray="${da.track} ${da.gap}"
          transform="rotate(-225 ${cx} ${cy})"/>
        <circle cx="${cx}" cy="${cy}" r="${r}"
          fill="none" stroke="${color}"
          stroke-width="${sw}" stroke-linecap="round"
          stroke-dasharray="${da.filled} ${da.empty}"
          transform="rotate(-225 ${cx} ${cy})"/>
        <text x="${cx}" y="${valY}"
          font-family="var(--paper-font-body1_-_font-family, system-ui, sans-serif)"
          font-size="${valSize}" font-weight="800"
          dominant-baseline="middle" text-anchor="middle"
          letter-spacing="-0.5"
          fill="var(--primary-text-color, #1c1c1e)">${valueText}</text>
        <text x="${cx}" y="${unitY}"
          font-family="var(--paper-font-body1_-_font-family, system-ui, sans-serif)"
          font-size="${unitSize}" font-weight="400"
          dominant-baseline="middle" text-anchor="middle"
          fill="var(--secondary-text-color, #8e8e93)">${unitText}</text>
      </svg>`;
  }

  // ── build battery SVG ────────────────────────────────────────────────────
  _batterySvg(socPct, batColor) {
    const innerH = 82;
    const fillH  = Math.max(0, Math.min(socPct / 100, 1)) * innerH;
    const fillY  = (93 - fillH).toFixed(1);
    const pctTxt = Math.round(socPct) + '%';
    const textFill = fillH < 24 ? '#fff' : 'var(--primary-text-color, #1c1c1e)';

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

    const pvRingSvg  = this._ringsvg(44, pvFrac,   '#34c759', 'rgba(52,199,89,0.12)',  this._fmt(pvVal, 'W'), 'Watt', 120);
    const batSvg     = this._batterySvg(socVal, batSocColor);

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
          background: var(--secondary-background-color, #fafafa);
          border: 1px solid var(--divider-color, rgba(0,0,0,0.05));
          border-radius: 16px;
          overflow: hidden;
          transition: opacity 0.15s, transform 0.12s;
        }
        .tile.clickable { cursor: pointer; }
        .tile.clickable:hover  { opacity: 0.82; }
        .tile.clickable:active { transform: scale(0.97); }

        /* PV TILE */
        .tile-pv {
          display: flex;
          min-height: 160px;
        }
        .pv-ring-area {
          flex: 1.6;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 14px 8px 10px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .pv-ring-area:hover  { background: rgba(52,199,89,0.04); }
        .pv-ring-area:active { opacity: 0.7; }
        .pv-ring-area svg    { width: 100%; max-width: 160px; height: auto; }
        .pv-label {
          font-size: 11px; font-weight: 500;
          color: var(--secondary-text-color, #8e8e93);
          margin-top: 5px;
        }
        .pv-divider {
          width: 1px;
          background: var(--divider-color, rgba(0,0,0,0.05));
          margin: 12px 0; flex-shrink: 0;
        }
        .strings-col {
          flex: 0.7;
          display: flex; flex-direction: column;
          justify-content: center;
          padding: 10px 10px; gap: 4px;
        }
        .string-item {
          border-radius: 8px; padding: 7px 9px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .string-item:hover  { background: rgba(48,209,88,0.09); }
        .string-item:active { opacity: 0.6; }
        .string-lbl {
          font-size: 9px; font-weight: 500;
          color: var(--secondary-text-color, #aeaeb2);
          text-transform: uppercase; letter-spacing: 0.3px;
        }
        .string-row {
          display: flex; align-items: baseline; gap: 2px; margin-top: 1px;
        }
        .string-val  { font-size: 13px; font-weight: 700; letter-spacing: -0.3px; line-height: 1; }
        .string-unit { font-size: 9px; color: var(--secondary-text-color, #8e8e93); }

        /* HOUSE TILE */
        .tile-house {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 18px 10px 12px; gap: 2px;
        }
        .house-icon  { font-size: 24px; margin-bottom: 4px; }
        .house-val   { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; line-height: 1; }
        .house-unit  { font-size: 11px; color: var(--secondary-text-color, #8e8e93); }
        .house-label { font-size: 11px; font-weight: 500; color: var(--secondary-text-color, #8e8e93); margin-top: 6px; }

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
          height: 3px; background: rgba(0,0,0,0.07);
          border-radius: 2px; overflow: hidden;
        }
        .bat-cap-fill { height: 100%; border-radius: 2px; }
        .bat-power-row { display: flex; align-items: center; gap: 8px; }
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
          <div class="tile tile-pv">
            <div class="pv-ring-area" data-entity="${c.entity_pv || ''}">
              ${pvRingSvg}
              <div class="pv-label">PV</div>
            </div>
            <div class="pv-divider"></div>
            <div class="strings-col">
              <div class="string-item" data-entity="${c.entity_string1 || ''}">
                <div class="string-lbl">S1</div>
                <div class="string-row">
                  <div class="string-val">${this._fmt(s1Val, 'W')}</div>
                  <div class="string-unit">W</div>
                </div>
              </div>
              <div class="string-item" data-entity="${c.entity_string2 || ''}">
                <div class="string-lbl">S2</div>
                <div class="string-row">
                  <div class="string-val">${this._fmt(s2Val, 'W')}</div>
                  <div class="string-unit">W</div>
                </div>
              </div>
            </div>
          </div>

          <!-- HAUSVERBRAUCH -->
          <div class="tile tile-house clickable" data-entity="${c.entity_house || ''}">
            <div class="house-icon">🏠</div>
            <div class="house-val">${this._fmt(houseVal, 'W')}</div>
            <div class="house-unit">Watt</div>
            <div class="house-label">Verbrauch</div>
          </div>

          <!-- BATTERIE (full width) -->
          <div class="tile tile-battery clickable" data-entity="${c.entity_battery_soc || ''}">
            ${batSvg}
            <div class="bat-divider"></div>
            <div class="bat-info">
              <div>
                <div class="bat-info-title">Speicher</div>
                <div class="bat-soc-row">
                  <div class="bat-soc-num">${this._fmt(socVal, '%')}</div>
                  <div class="bat-soc-unit">%</div>
                </div>
              </div>
              <div class="bat-cap-bar">
                <div class="bat-cap-fill" style="width:${batCapPct}%;background:${batSocColor}"></div>
              </div>
              <div class="bat-power-row">
                <div class="bat-power-pill" style="background:${batPillBg}">
                  <span class="bat-arrow" style="color:${batPowColor}">${batArrow}</span>
                  <span class="bat-pow-num" style="color:${batPowColor}">${batPowDisplay}</span>
                  <span class="bat-pow-unit">W</span>
                </div>
                <span class="bat-status" style="color:${batPowColor}">${batStatus}</span>
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

    // PV ring
    const pvRing = this.shadowRoot.querySelector('.pv-ring-area[data-entity]');
    if (pvRing) {
      pvRing.addEventListener('click', () => this._moreInfo(pvRing.dataset.entity));
    }

    // String items
    this.shadowRoot.querySelectorAll('.string-item[data-entity]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        this._moreInfo(el.dataset.entity);
      });
    });

    // Tiles with data-entity (house, battery)
    this.shadowRoot.querySelectorAll('.tile[data-entity]').forEach(el => {
      el.addEventListener('click', () => this._moreInfo(el.dataset.entity));
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
