// ============================================================
// SF2E BRIDGE | shop-buy.js — Sci-Fi Compendium Shop
// Refatorado conforme SF2E-Bridge-Shop-Overhaul-Guide.md v1.0
// ============================================================

import { readCredits, deductCredits, addCredits } from "./credits-utils.js";
import { appendTransactionLog }                   from "./journal-log.js";
import { getIconHtml }                            from "./icon-config.js";
import { debugLog, warnAlert }                    from "./debug-utils.js";

// ─── Constantes ────────────────────────────────────────────

const SELLABLE_TYPES = [
  "weapon", "armor", "shield", "consumable", "equipment",
  "backpack", "kit", "treasure", "ammo", "augmentation", "upgrade",
];

// Tabs are listed in alphabetical order — reorder entries here to change tab order
const COMPENDIUMS = {
  abilities: {
    pack:        "sf2e.actions",
    label:       "Abilities",
    icon:        "fas fa-running",
    types:       ["action"],
    priceFilter: false,
  },
  equipment: {
    pack:        "sf2e.equipment",
    label:       "Equipment",
    icon:        "fas fa-box",
    types:       ["weapon","armor","shield","consumable","equipment",
                  "backpack","kit","treasure","ammo","augmentation","upgrade"],
    priceFilter: true,
  },
  feats: {
    pack:        "sf2e.feats",
    label:       "Feats",
    icon:        "fas fa-star",
    // Only pure feats — features are in their own tab
    types:       ["feat"],
    priceFilter: false,
  },
  features: {
    pack:        "sf2e.feats",
    label:       "Features",
    icon:        "fas fa-cubes",
    // Class features, ancestry features, etc.
    types:       ["feat-feature","class-feature","ancestry-feature","heritage","class"],
    priceFilter: false,
  },
  spells: {
    pack:        "sf2e.spells",
    label:       "Spells",
    icon:        "fas fa-magic",
    types:       ["spell"],
    priceFilter: false,
  },
  sell: {
    pack:        null,
    label:       "Sell",
    icon:        "fas fa-hand-holding-usd",
    types:       SELLABLE_TYPES,
    priceFilter: false,
  },
};

const PAGE_SIZE       = 100;
const DEFAULT_SELL_RATIO = 0.5;

// ─── Dados estáticos dos filtros ────────────────────────────────────────────

const INVENTORY_TYPES = [
  { value: "ammunition",   label: "Ammunition" },
  { value: "armor",        label: "Armor" },
  { value: "consumable",   label: "Consumable" },
  { value: "backpack",     label: "Container" },
  { value: "equipment",    label: "Equipment" },
  { value: "kit",          label: "Kit" },
  { value: "shield",       label: "Shield" },
  { value: "treasure",     label: "Treasure" },
  { value: "weapon",       label: "Weapon" },
];

const WEAPON_CATEGORIES = [
  { value: "simple",   label: "Simple Weapon" },
  { value: "martial",  label: "Martial Weapon" },
  { value: "advanced", label: "Advanced Weapon" },
  { value: "unarmed",  label: "Unarmed Attack" },
];

const WEAPON_GROUPS = [
  "axe","brawling","club","dart","flail","hammer","knife",
  "pick","polearm","shield","spear","sword",
  "bomb","bow","corrosive","crossbow","cryo","firearm",
  "flame","grenade","laser","mental","plasma","poison",
  "projectile","shock","sling","sniper","sonic",
];

const ARMOR_CATEGORIES = [
  { value: "unarmored",     label: "Unarmored" },
  { value: "light",         label: "Light Armor" },
  { value: "medium",        label: "Medium Armor" },
  { value: "heavy",         label: "Heavy Armor" },
  { value: "light-barding", label: "Light Barding" },
  { value: "heavy-barding", label: "Heavy Barding" },
  { value: "ceramic",       label: "Ceramic" },
  { value: "chain",         label: "Chain" },
  { value: "cloth",         label: "Cloth" },
  { value: "composite",     label: "Composite" },
  { value: "leather",       label: "Leather" },
  { value: "plate",         label: "Plate" },
  { value: "polymer",       label: "Polymer" },
  { value: "skeletal",      label: "Skeletal" },
  { value: "wood",          label: "Wood" },
];

const ACTION_TYPES = [
  { value: "action",   label: "Action" },
  { value: "free",     label: "Free Action" },
  { value: "passive",  label: "Passive" },
  { value: "reaction", label: "Reaction" },
];

// Categories present in the sf2e.feats pack — confirmed from system data
// Feats tab shows: ancestry, skill, bonus, general
// Features tab shows: class
const FEAT_CATEGORIES = [
  { value: "ancestry", label: "Ancestry Feat" },
  { value: "bonus",    label: "Bonus Feat" },
  { value: "class",    label: "Class Feature" },
  { value: "general",  label: "General Feat" },
  { value: "skill",    label: "Skill Feat" },
];

// Skills used to filter Skill Feats — matches SF2e skill list
const FEAT_SKILLS = [
  "acrobatics","athletics","computers","crafting","deception",
  "diplomacy","engineering","intimidation","medicine","mysticism",
  "perception","piloting","profession","sense motive","sleight of hand",
  "stealth","survival","thievery",
];

// ─── CSS Injection ─────────────────────────────────────────

function injectCSS() {
  const ID = "sf2e-shop-style";
  if (document.getElementById(ID)) return;
  const style = document.createElement("style");
  style.id = ID;
  style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700&family=Exo+2:wght@300;400;600&family=Share+Tech+Mono&display=swap');

/* ══════════════════════════════════════════
   SF2E BRIDGE | SCI-FI SHOP THEME
   ══════════════════════════════════════════ */

.sf2e-shop-app.window-app {
  --sf-bg-deep:    #050810;
  --sf-bg-base:    #0a0f1a;
  --sf-bg-panel:   #0d1420;
  --sf-bg-row:     #0f1728;
  --sf-border:     #1a2840;
  --sf-border-hi:  #1e4080;
  --sf-cyan:       #00d2ff;
  --sf-cyan-dim:   #005580;
  --sf-gold:       #f0c040;
  --sf-green:      #39d353;
  --sf-red:        #ff4455;
  --sf-purple:     #a855f7;
  --sf-text:       #c8d8f0;
  --sf-text-dim:   #4a6080;
  --sf-text-bright:#e8f0ff;
  /* ── Customizable item name colors ── */
  --sf-item-name-color:       #60a5fa;   /* Default item name color — change to any color */
  --sf-item-name-hover-color: #a855f7;   /* Item name color on row hover — change to any color */

  /* ── Customizable filter group label & active tab colors ── */
  --sf-filter-label-color:       #f0c040; /* Filter group title color — gold by default */
  --sf-active-tab-color:         #f0c040; /* Active tab text + underline color — gold by default */
  --sf-active-tab-glow:          rgba(240,192,64,0.45); /* Active tab text-shadow glow color */
  --sf-font-hud:   'Orbitron', 'Teko', sans-serif;
  --sf-font-body:  'Exo 2', sans-serif;
  --sf-font-mono:  'Share Tech Mono', monospace;
  min-width: 600px !important;
  min-height: 400px !important;
  display: flex !important;
  flex-direction: column !important;
  background: var(--sf-bg-base) !important;
  border: 1px solid var(--sf-border-hi) !important;
  box-shadow: 0 0 30px rgba(0,210,255,0.12), 0 0 60px rgba(0,0,0,0.8) !important;
}
.sf2e-shop-app .window-resizable-handle { 
  z-index: 10; 
  filter: drop-shadow(0 0 5px var(--sf-cyan));
}
.sf2e-shop-app .window-header {
  background: var(--sf-bg-deep) !important;
  border-bottom: 1px solid var(--sf-border) !important;
  color: var(--sf-cyan) !important;
  font-family: var(--sf-font-hud) !important;
  font-size: 0.72em !important;
  letter-spacing: 0.18em !important;
  text-transform: uppercase !important;
}
.sf2e-shop-app .window-content {
  background: transparent !important;
  padding: 0 !important;
  overflow: hidden !important;
  display: flex !important;
  flex: 1 !important;
}

/* ── Wrap principal ── */
.sf-shop-wrap {
  display: flex;
  flex: 1;
  height: 100%;
  width: 100%;
  background: var(--sf-bg-base);
  color: var(--sf-text);
  font-family: var(--sf-font-body);
  overflow: hidden;
  position: relative;
}
.sf-shop-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg, transparent, transparent 3px,
    rgba(0,210,255,0.012) 3px, rgba(0,210,255,0.012) 4px
  );
  pointer-events: none;
  z-index: 0;
}

/* ── Painel de filtros ── */
.sf-filter-panel {
  width: 280px;
  min-width: 280px;
  background: var(--sf-bg-panel);
  border-right: 1px solid var(--sf-border);
  overflow-y: auto;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  z-index: 1;
}
.sf-filter-panel::-webkit-scrollbar { width: 3px; }
.sf-filter-panel::-webkit-scrollbar-thumb { background: var(--sf-border); border-radius: 2px; }
.sf-filter-header {
  font-family: var(--sf-font-hud);
  font-size: 1.2em;
  font-size: 1.3em;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--sf-cyan-dim);
  padding: 8px 4px 12px;
  border-bottom: 1px solid var(--sf-border);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sf-filter-header::before {
  content: '';
  width: 3px;
  height: 14px;
  background: var(--sf-cyan);
  box-shadow: 0 0 8px var(--sf-cyan);
  flex-shrink: 0;
}
.sf-filter-reset {
  width: 100%;
  background: rgba(255,68,85,0.08);
  border: 1px solid rgba(255,68,85,0.3);
  color: #ff6677;
  font-family: var(--sf-font-hud);
  font-size: 1.2em;
  font-size: 1.3em;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 7px;
  border-radius: 2px;
  cursor: pointer;
  margin-bottom: 6px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
}
.sf-filter-reset:hover { background: rgba(255,68,85,0.15); box-shadow: 0 0 10px rgba(255,68,85,0.2); }
.sf-filter-group { border-bottom: 1px solid rgba(26,40,64,0.8); padding: 8px 4px; }
.sf-filter-group-title {
  font-family: var(--sf-font-hud);
  font-size: 1.2em;
  font-size: 1.3em;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--sf-filter-label-color); /* Filter group title color — edit --sf-filter-label-color above */
  margin-bottom: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: color 0.15s;
  user-select: none;
}
.sf-filter-group-title:hover { color: var(--sf-cyan); }
.sf-filter-group-title i { font-size: 0.85em; transition: transform 0.2s; }
.sf-filter-group-title.collapsed i { transform: rotate(-90deg); }
.sf-filter-body { display: flex; flex-direction: column; gap: 2px; }
.sf-filter-body.hidden { display: none; }
.sf-filter-check {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 1.2em;
  font-size: 1.3em;
  color: var(--sf-text);
  cursor: pointer;
  padding: 3px 2px;
  user-select: none;
  border-radius: 2px;
  transition: color 0.1s;
}
.sf-filter-check:hover { color: #fff; }
.sf-filter-check input[type="checkbox"] { accent-color: var(--sf-cyan); width: 12px; height: 12px; }
.sf-filter-range {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 1.2em;
  font-size: 1.3em;
  color: var(--sf-text-dim);
}
.sf-filter-range input[type="number"] {
  width: 60px;
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--sf-border);
  color: var(--sf-text);
  font-family: var(--sf-font-mono);
  font-size: 0.9em;
  padding: 3px 5px;
  border-radius: 2px;
  outline: none;
  text-align: center;
}
.sf-filter-range input:focus { border-color: var(--sf-cyan); }
.sf-trait-search {
  width: 100%;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--sf-border);
  color: var(--sf-text);
  font-family: var(--sf-font-body);
  font-size: 0.76em;
  padding: 4px 7px;
  border-radius: 2px;
  outline: none;
  margin-bottom: 4px;
  transition: border-color 0.15s;
}
.sf-trait-search:focus { border-color: var(--sf-cyan); }
.sf-trait-search::placeholder { color: var(--sf-text-dim); }
.sf-trait-list {
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.sf-trait-list::-webkit-scrollbar { width: 3px; }
.sf-trait-list::-webkit-scrollbar-thumb { background: var(--sf-border); border-radius: 2px; }
.sf-sell-ratio-wrap { display: flex; flex-direction: column; gap: 4px; }
.sf-sell-ratio-value {
  font-family: var(--sf-font-mono);
  font-size: 0.9em;
  color: var(--sf-gold);
  text-align: center;
}
input[type="range"].sf-range-slider {
  width: 100%;
  accent-color: var(--sf-cyan);
  cursor: pointer;
}

/* ── Área principal ── */
.sf-shop-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

/* ── Abas ── */
.sf-comp-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 10px 0;
  background: var(--sf-bg-deep);
  border-bottom: 1px solid var(--sf-border);
  flex-wrap: nowrap;
  flex-shrink: 0;
  overflow-x: auto;
}
.sf-comp-tabs::-webkit-scrollbar { height: 2px; }
.sf-comp-tabs::-webkit-scrollbar-thumb { background: var(--sf-border); }
.sf-comp-tab {
  font-family: var(--sf-font-hud);
  font-size: 1.2em;
  font-size: 1.3em;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--sf-text-dim);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 7px 12px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  flex-shrink: 0;
}
.sf-comp-tab:hover { color: var(--sf-cyan); }
.sf-comp-tab.active {
  color: var(--sf-active-tab-color);         /* Active tab text color — edit --sf-active-tab-color above */
  border-bottom-color: var(--sf-active-tab-color); /* Active tab underline — follows same variable */
  text-shadow: 0 0 8px var(--sf-active-tab-glow);  /* Active tab glow — edit --sf-active-tab-glow above */
}

/* ── Toolbar ── */
.sf-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #080d16;
  border-bottom: 1px solid var(--sf-border);
  flex-shrink: 0;
}
.sf-search-wrap { flex: 1; position: relative; }
.sf-search-wrap i {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--sf-text-dim);
  font-size: 0.78em;
  pointer-events: none;
}
.sf-search-input {
  width: 100%;
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--sf-border);
  color: var(--sf-text);
  font-family: var(--sf-font-body);
  font-size: 0.85em;
  padding: 6px 10px 6px 30px;
  border-radius: 2px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
}
.sf-search-input:focus {
  border-color: var(--sf-cyan);
  box-shadow: 0 0 0 1px rgba(0,210,255,0.2);
}
.sf-search-input::placeholder { color: var(--sf-text-dim); }
.sf-sort-select {
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--sf-border);
  color: var(--sf-text);
  font-family: var(--sf-font-body);
  font-size: 0.8em;
  padding: 5px 7px;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.sf-sort-select:focus { border-color: var(--sf-cyan); }
.sf-sort-dir-btn {
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--sf-border);
  color: var(--sf-text-dim);
  padding: 5px 9px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 0.85em;
  transition: all 0.15s;
}
.sf-sort-dir-btn:hover { color: var(--sf-cyan); border-color: var(--sf-cyan-dim); }

/* ── Cabeçalho de colunas ── */
.sf-list-header {
  display: grid;
  grid-template-columns: 8px 44px 1fr 44px 84px 52px 90px;
  gap: 6px;
  align-items: center;
  padding: 5px 10px;
  background: rgba(0,0,0,0.3);
  border-bottom: 2px solid var(--sf-border);
  font-family: var(--sf-font-hud);
  font-size: 0.58em;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--sf-gold);
  flex-shrink: 0;
}

/* ── Lista de itens ── */
.sf-item-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.sf-item-list::-webkit-scrollbar { width: 5px; }
.sf-item-list::-webkit-scrollbar-track { background: transparent; }
.sf-item-list::-webkit-scrollbar-thumb { background: var(--sf-border); border-radius: 3px; }
.sf-item-list::-webkit-scrollbar-thumb:hover { background: var(--sf-cyan-dim); }

/* ── Linha de item ── */
.sf-item-row {
  display: grid;
  grid-template-columns: 8px 44px 1fr 44px 84px 52px 90px;
  gap: 6px;
  align-items: center;
  padding: 4px 10px;
  border-bottom: 1px solid rgba(26,40,64,0.5);
  border-left: 2px solid transparent;
  transition: background 0.1s, border-left-color 0.1s;
  cursor: default;
}
.sf-item-row:hover { background: rgba(0,210,255,0.04); border-left-color: var(--sf-cyan); }
.sf-item-row:nth-child(even) { background: rgba(255,255,255,0.013); }
.sf-item-row:nth-child(even):hover { background: rgba(0,210,255,0.04); }
.sf-item-img-wrap {
  position: relative;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
}
.sf-item-img {
  width: 34px; height: 34px;
  border-radius: 3px;
  border: 1px solid var(--sf-border);
  object-fit: cover;
  background: #000;
}
.sf-prof-badge {
  position: absolute;
  bottom: -4px;
  right: -5px;
  background: #0f0a19;
  border: 1px solid var(--sf-badge-color, #6b7280);
  color: var(--sf-badge-color, #6b7280);
  font-family: var(--sf-font-mono);
  font-size: 0.58em;
  font-weight: bold;
  line-height: 1;
  padding: 1px 3px;
  border-radius: 2px;
  pointer-events: none;
  box-shadow: 0 0 4px var(--sf-badge-color, #6b7280);
  z-index: 1;
}
.sf-item-name {
  color: var(--sf-item-name-color);
  font-size: 1.3em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sf-item-row:hover .sf-item-name {
  color: var(--sf-item-name-hover-color);
}
.sf-item-level {
  font-family: var(--sf-font-mono);
  font-size: 0.8em;
  color: var(--sf-gold);
  text-align: right;
}
.sf-item-price {
  font-family: var(--sf-font-mono);
  font-size: 0.9em;
  color: var(--sf-gold);
  text-align: right;
}
.sf-item-price .sf-cr {
  font-size: 0.9em;
  color: var(--sf-gold);
  margin-left: 2px;
}
.sf-item-owned { display: flex; align-items: center; justify-content: center; }
.sf-owned-badge {
  background: rgba(0,210,255,0.12);
  border: 1px solid rgba(0,210,255,0.3);
  color: var(--sf-gold);
  font-family: var(--sf-font-mono);
  font-size: 0.8em;
  padding: 1px 6px;
  border-radius: 10px;
  white-space: nowrap;
}
.sf-owned-empty { color: var(--sf-text-dim); font-size: 0.78em; }

/* Dot de raridade */
.sf-rarity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.sf-rarity-dot.sf-rarity-common   { background: #6b7280; }
.sf-rarity-dot.sf-rarity-uncommon { background: #39d353; box-shadow: 0 0 4px #39d353; }
.sf-rarity-dot.sf-rarity-rare     { background: #60a5fa; box-shadow: 0 0 4px #60a5fa; }
.sf-rarity-dot.sf-rarity-unique   { background: #c084fc; box-shadow: 0 0 6px #c084fc; }

/* Badges de raridade inline */
.sf-rarity-badge {
  font-size: 0.68em;
  font-family: var(--sf-font-hud);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 2px;
  border: 1px solid;
  white-space: nowrap;
}
.sf-rarity-badge.sf-rarity-common   { color: #9ca3af; border-color: #374151; }
.sf-rarity-badge.sf-rarity-uncommon { color: #39d353; border-color: #166534; box-shadow: 0 0 4px #39d35340; }
.sf-rarity-badge.sf-rarity-rare     { color: #60a5fa; border-color: #1d4ed8; box-shadow: 0 0 4px #60a5fa40; }
.sf-rarity-badge.sf-rarity-unique   { color: #c084fc; border-color: #7e22ce; box-shadow: 0 0 6px #c084fc60; }

/* ── Botões de ação ── */
.sf-item-actions { display: flex; align-items: center; gap: 2px; justify-content: flex-end; }
.sf-action-btn {
  background: none;
  border: none;
  color: var(--sf-text-dim);
  font-size: 0.88em;
  cursor: pointer;
  padding: 4px 5px;
  border-radius: 2px;
  transition: all 0.12s;
  line-height: 1;
}
.sf-action-btn:hover { color: var(--sf-cyan); }
.sf-action-btn.sf-buy:hover  { color: var(--sf-green); text-shadow: 0 0 6px var(--sf-green); }
.sf-action-btn.sf-sell:hover { color: var(--sf-red);   text-shadow: 0 0 6px var(--sf-red); }

/* ── Paginação ── */
.sf-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 5px 10px;
  border-top: 1px solid var(--sf-border);
  background: var(--sf-bg-panel);
  flex-shrink: 0;
  font-family: var(--sf-font-mono);
  font-size: 0.75em;
  color: var(--sf-text-dim);
}
.sf-page-btn {
  background: rgba(0,210,255,0.06);
  border: 1px solid var(--sf-border);
  color: var(--sf-text-dim);
  font-family: var(--sf-font-mono);
  font-size: 0.9em;
  padding: 3px 10px;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.15s;
  clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px));
}
.sf-page-btn:hover:not(:disabled) { color: var(--sf-cyan); border-color: var(--sf-cyan); box-shadow: 0 0 8px rgba(0,210,255,0.2); }
.sf-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Footer ── */
.sf-shop-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--sf-bg-deep);
  border-top: 1px solid var(--sf-border);
  flex-shrink: 0;
  font-family: var(--sf-font-mono);
  font-size: 0.7em;
  color: var(--sf-text-dim);
}
.sf-credits-display {
  color: var(--sf-gold);
  font-weight: bold;
  font-size: 1.6em;
  letter-spacing: 0.03em;
  text-shadow: 0 0 6px rgba(250, 204, 21, 0.4);
}
.sf-credits-display i { margin-right: 6px; }
.sf-footer-info { font-size: 0.75em; }

/* ── Loading / Empty ── */
.sf-shop-loading, .sf-shop-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--sf-text-dim);
  font-size: 0.85em;
  gap: 10px;
}
.sf-shop-loading i, .sf-shop-empty i { font-size: 2em; opacity: 0.25; }
@keyframes sf-spin { to { transform: rotate(360deg); } }
.sf-spinner { animation: sf-spin 1.2s linear infinite; }

/* ── Toast ── */
.sf-toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 99999;
  background: var(--sf-bg-panel);
  border: 1px solid var(--sf-cyan-dim);
  border-left: 3px solid var(--sf-cyan);
  border-radius: 3px;
  padding: 10px 16px;
  font-family: var(--sf-font-body);
  font-size: 0.85em;
  color: var(--sf-text);
  box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 15px rgba(0,210,255,0.1);
  animation: sf-toast-in 0.25s ease;
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
  max-width: 320px;
}
.sf-toast.error { border-color: var(--sf-red); border-left-color: var(--sf-red); }
.sf-toast.success { border-color: var(--sf-green); border-left-color: var(--sf-green); }
@keyframes sf-toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* ── Trait mode row (All of above / Any of above) ── */
.sf-trait-mode-row {
  display: flex;
  gap: 12px;
  margin: 4px 0 6px;
}
.sf-mode-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78em;
  color: var(--sf-text-dim);
  cursor: pointer;
  user-select: none;
}
.sf-mode-label input[type="radio"] {
  accent-color: #f0a000;
  width: 13px;
  height: 13px;
}
.sf-mode-label:has(input:checked) { color: var(--sf-text); }

/* ── Botão Clear por grupo ── */
.sf-group-clear {
  margin-left: auto;
  background: rgba(240,160,0,0.10);
  border: 1px solid rgba(240,160,0,0.35);
  color: #f0a000;
  font-family: var(--sf-font-hud);
  font-size: 0.58em;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 2px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 10px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.sf-group-clear:hover {
  background: rgba(240,160,0,0.22);
  box-shadow: 0 0 6px rgba(240,160,0,0.25);
}

/* ── Título do grupo com clear alinhado ── */
.sf-filter-group-title {
  display: flex;
  align-items: center;
  gap: 5px;
}
.sf-group-label { 
  flex: 1; 
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Trait search wrap ── */
.sf-trait-search-wrap { margin-bottom: 4px; }
.sf-trait-search-wrap .sf-trait-search { margin-bottom: 0; }
  `;
  document.head.appendChild(style);
}

// ─── Utilitários ───────────────────────────────────────────

function toast(msg, type = "info", duration = 3000) {
  const el = document.createElement("div");
  el.className = `sf-toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function blankFilters() {
  return {
    // Shared across all tabs
    rarity:           [],     // string[]  — Common/Uncommon/Rare/Unique
    traits:           [],     // string[]  — selected traits
    traitMode:        "all",  // "all" | "any"
    sources:          [],     // string[]  — publication sources
    levelMin:         null,
    levelMax:         null,
    priceMin:         null,
    priceMax:         null,

    // Equipment — Inventory Types
    inventoryTypes:   [],     // string[] — "weapon","armor","consumable", etc.

    // Equipment — Weapon Filters
    weaponCategories: [],     // string[] — "simple","martial","advanced","unarmed"
    weaponGroups:     [],     // string[] — "axe","sword","firearm", etc.

    // Equipment — Armor Filters
    armorCategories:  [],     // string[] — "unarmored","light","medium","heavy", etc.

    // Abilities — Action Type
    actionTypes:      [],     // string[] — "action","free","passive","reaction"

    // Abilities — Familiar Ability category flag
    familiarAbility:  false,  // boolean  — true = show only Familiar Ability entries

    // Feats / Features — Categories
    featCategories:   [],     // string[] — matches FEAT_CATEGORIES values

    // Feats / Features — Skill filter (for Skill Feats)
    skills:           [],     // string[] — matches FEAT_SKILLS values
  };
}

// ─── Classe Principal ──────────────────────────────────────

export class SF2eShopBuyApplication extends Application {

  // ── defaultOptions ────────────────────────────────────

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:        "sf2e-shop-unified",  // main.js busca por este ID
      template:  null,
      title:     "SF2e Market",
      width:     980,
      height:    700,
      resizable: true,
      classes:   ["sf2e-shop-app", "sf2e-sci-fi"],
    });
  }

  // ── Constructor ───────────────────────────────────────

  constructor(actor, options = {}) {
    super(options);
    this.actor       = actor;
    this._compendium = "equipment";
    this._search     = "";
    this._filters    = blankFilters();
    this._sortBy     = "name";
    this._sortDir    = "asc";
    this._page       = 0;
    this._cache      = new Map();
    this._allTraits  = [];
    this._allSources = [];
    this._traitSearch = "";
    this._loading    = false;
    this._sellRatio  = DEFAULT_SELL_RATIO;
    this._filterCollapsed = {};
  }

  // ── getData ───────────────────────────────────────────

  async getData() { return {}; }

  // ── _renderInner ──────────────────────────────────────

  async _renderInner() {
    injectCSS();
    const html = $(`<div class="sf-shop-wrap"></div>`);
    html.append(this._renderFilterPanel());
    html.append(this._renderMain());
    return html;
  }

  // ── _renderMain ───────────────────────────────────────

  _renderMain() {
    return `
    <div class="sf-shop-main">
      ${this._renderTabs()}
      ${this._renderToolbar()}
      ${this._renderListHeader()}
      <div class="sf-item-list" id="sf-item-list-container">
        <div class="sf-shop-loading">
          <i class="fas fa-circle-notch sf-spinner"></i>
          <span>Loading compendium data…</span>
        </div>
      </div>
      ${this._renderPagination(0, 0)}
      ${this._renderFooter()}
    </div>`;
  }

  // ── _renderTabs ───────────────────────────────────────

  _renderTabs() {
    const tabs = Object.entries(COMPENDIUMS)
      .map(([key, c]) => `
        <button class="sf-comp-tab${this._compendium === key ? " active" : ""}"
          data-comp="${key}">
          <i class="${c.icon}"></i>${c.label}
        </button>`).join("");
    return `<div class="sf-comp-tabs">${tabs}</div>`;
  }

  // ── _renderToolbar ────────────────────────────────────

  _renderToolbar() {
    return `
    <div class="sf-toolbar">
      <div class="sf-search-wrap">
        <i class="fas fa-search"></i>
        <input class="sf-search-input" type="text" placeholder="Search…" value="${this._search}">
      </div>
      <select class="sf-sort-select" id="sf-sort-by">
        <option value="name"  ${this._sortBy==="name"  ?"selected":""}>Name</option>
        <option value="level" ${this._sortBy==="level" ?"selected":""}>Level</option>
        <option value="price" ${this._sortBy==="price" ?"selected":""}>Price</option>
        <option value="rarity"${this._sortBy==="rarity"?"selected":""}>Rarity</option>
      </select>
      <button class="sf-sort-dir-btn" id="sf-sort-dir" title="Toggle sort direction">
        <i class="fas fa-sort-amount-${this._sortDir === "asc" ? "up" : "down"}"></i>
      </button>
    </div>`;
  }

  // ── _renderListHeader ─────────────────────────────────

  _renderListHeader() {
    return `
    <div class="sf-list-header">
      <span></span>
      <span></span>
      <span>Name</span>
      <span>Lvl</span>
      <span style="text-align:right">Price</span>
      <span style="text-align:center">Owned</span>
      <span style="text-align:right">Actions</span>
    </div>`;
  }

  // ── _renderFilterPanel ────────────────────────────────

  _renderFilterPanel() {
    const comp = COMPENDIUMS[this._compendium];
    let groups = "";

    // ── Traits (all tabs — with search field + All/Any mode toggle) ──
    if (this._allTraits.length > 0) {
      const filtered = this._traitSearch
        ? this._allTraits.filter(t => t.toLowerCase().includes(this._traitSearch.toLowerCase()))
        : this._allTraits;
      const traitChecks = filtered.map(t => `
      <label class="sf-filter-check">
        <input type="checkbox" data-filter="traits" value="${t}"
          ${this._filters.traits.includes(t) ? "checked" : ""}> ${t}
      </label>`).join("");
      const hasTraits = this._filters.traits.length > 0;
      groups += this._filterGroup("traits", "Traits", `
      <div class="sf-trait-search-wrap">
        <input class="sf-trait-search" type="text" placeholder="Select"
          id="sf-trait-search" value="${this._traitSearch}">
      </div>
      <div class="sf-trait-mode-row">
        <label class="sf-mode-label">
          <input type="radio" name="sf-trait-mode" value="all"
            ${this._filters.traitMode !== "any" ? "checked" : ""}> All of above
        </label>
        <label class="sf-mode-label">
          <input type="radio" name="sf-trait-mode" value="any"
            ${this._filters.traitMode === "any" ? "checked" : ""}> Any of above
        </label>
      </div>
      <div class="sf-trait-list">${traitChecks}</div>
    `, hasTraits);
    }

    // ── Inventory Types (Equipment only) ─────────────────────
    if (this._compendium === "equipment") {
      const checks = INVENTORY_TYPES.map(t => `
      <label class="sf-filter-check">
        <input type="checkbox" data-filter="inventoryTypes" value="${t.value}"
          ${this._filters.inventoryTypes.includes(t.value) ? "checked" : ""}> ${t.label}
      </label>`).join("");
      const hasActive = this._filters.inventoryTypes.length > 0;
      groups += this._filterGroup("inventoryTypes", "Inventory Types", checks, hasActive);
    }

    // ── Rarities (all tabs) ───────────────────────────────────
    {
      const checks = ["common","uncommon","rare","unique"].map(r => `
      <label class="sf-filter-check">
        <input type="checkbox" data-filter="rarity" value="${r}"
          ${this._filters.rarity.includes(r) ? "checked" : ""}>
        <span class="sf-rarity-badge sf-rarity-${r}">${r}</span>
      </label>`).join("");
      const hasActive = this._filters.rarity.length > 0;
      groups += this._filterGroup("rarity", "Rarities", checks, hasActive);
    }

    // ── Armor Filters (Equipment only) ───────────────────────
    if (this._compendium === "equipment") {
      const checks = ARMOR_CATEGORIES.map(a => `
      <label class="sf-filter-check">
        <input type="checkbox" data-filter="armorCategories" value="${a.value}"
          ${this._filters.armorCategories.includes(a.value) ? "checked" : ""}> ${a.label}
      </label>`).join("");
      const hasActive = this._filters.armorCategories.length > 0;
      groups += this._filterGroup("armorCategories", "Armor Filters", checks, hasActive);
    }

    // ── Weapon Filters (Equipment only) ──────────────────────
    if (this._compendium === "equipment") {
      const catChecks = WEAPON_CATEGORIES.map(c => `
      <label class="sf-filter-check">
        <input type="checkbox" data-filter="weaponCategories" value="${c.value}"
          ${this._filters.weaponCategories.includes(c.value) ? "checked" : ""}> ${c.label}
      </label>`).join("");
      const grpChecks = WEAPON_GROUPS.map(g => `
      <label class="sf-filter-check">
        <input type="checkbox" data-filter="weaponGroups" value="${g}"
          ${this._filters.weaponGroups.includes(g) ? "checked" : ""}> ${g.charAt(0).toUpperCase() + g.slice(1)}
      </label>`).join("");
      const hasActive = this._filters.weaponCategories.length > 0 || this._filters.weaponGroups.length > 0;
      groups += this._filterGroup("weaponFilters", "Weapon Filters", catChecks + grpChecks, hasActive);
    }

    // ── Action Type (Abilities only) ──────────────────────────
    if (this._compendium === "abilities") {
      const checks = ACTION_TYPES.map(a => `
      <label class="sf-filter-check">
        <input type="checkbox" data-filter="actionTypes" value="${a.value}"
          ${this._filters.actionTypes.includes(a.value) ? "checked" : ""}> ${a.label}
      </label>`).join("");
      const hasActive = this._filters.actionTypes.length > 0;
      groups += this._filterGroup("actionTypes", "Action Type", checks, hasActive);
    }

    // ── Familiar Ability (Abilities only) ────────────────────
    if (this._compendium === "abilities") {
      const hasActive = this._filters.familiarAbility;
      groups += this._filterGroup("familiarAbility", "Categories", `
      <label class="sf-filter-check">
        <input type="checkbox" data-filter="familiarAbility" value="familiar"
          ${this._filters.familiarAbility ? "checked" : ""}> Familiar Ability
      </label>
    `, hasActive);
    }

    // ── Categories (Feats and Features) ──────────────────────
    if (this._compendium === "feats" || this._compendium === "features") {
      const checks = FEAT_CATEGORIES.map(c => `
      <label class="sf-filter-check">
        <input type="checkbox" data-filter="featCategories" value="${c.value}"
          ${this._filters.featCategories.includes(c.value) ? "checked" : ""}> ${c.label}
      </label>`).join("");
      const hasActive = this._filters.featCategories.length > 0;
      groups += this._filterGroup("featCategories", "Categories", checks, hasActive);
    }

    // ── Skills (Feats and Features — for filtering Skill Feats) ──
    if (this._compendium === "feats" || this._compendium === "features") {
      const checks = FEAT_SKILLS.map(sk => `
      <label class="sf-filter-check">
        <input type="checkbox" data-filter="skills" value="${sk}"
          ${this._filters.skills.includes(sk) ? "checked" : ""}> ${sk.charAt(0).toUpperCase() + sk.slice(1)}
      </label>`).join("");
      const hasActive = this._filters.skills.length > 0;
      groups += this._filterGroup("skills", "Skills", checks, hasActive);
    }

    // ── Level Range (all tabs) ────────────────────────────────
    {
      const hasActive = this._filters.levelMin !== null || this._filters.levelMax !== null;
      groups += this._filterGroup("level", "Level Range", `
      <div class="sf-filter-range">
        <input type="number" min="0" max="25" placeholder="Min"
          id="sf-level-min" value="${this._filters.levelMin ?? ""}">
        <span>–</span>
        <input type="number" min="0" max="25" placeholder="Max"
          id="sf-level-max" value="${this._filters.levelMax ?? ""}">
      </div>
    `, hasActive);
    }

    // ── Price Range (Equipment only) ──────────────────────────
    if (comp?.priceFilter) {
      const hasActive = this._filters.priceMin !== null || this._filters.priceMax !== null;
      groups += this._filterGroup("price", "Price (CR)", `
      <div class="sf-filter-range">
        <input type="number" min="0" placeholder="Min"
          id="sf-price-min" value="${this._filters.priceMin ?? ""}">
        <span>–</span>
        <input type="number" min="0" placeholder="Max"
          id="sf-price-max" value="${this._filters.priceMax ?? ""}">
      </div>
    `, hasActive);
    }

    // ── Sources (Abilities, Feats, Features — populated from loaded items) ──
    if (["abilities","feats","features"].includes(this._compendium) && this._allSources.length > 0) {
      const sourceChecks = this._allSources.slice(0, 30).map(s => `
      <label class="sf-filter-check">
        <input type="checkbox" data-filter="sources" value="${s}"
          ${this._filters.sources.includes(s) ? "checked" : ""}> ${s}
      </label>`).join("");
      const hasActive = this._filters.sources.length > 0;
      groups += this._filterGroup("sources", "Sources", sourceChecks, hasActive);
    }

    // ── Sell Ratio (Sell only) ────────────────────────────────
    if (this._compendium === "sell") {
      const pct = Math.round(this._sellRatio * 100);
      groups += this._filterGroup("sellRatio", "Sell Ratio", `
      <div class="sf-sell-ratio-wrap">
        <div class="sf-sell-ratio-value" id="sf-sell-ratio-val">${pct}%</div>
        <input type="range" class="sf-range-slider" id="sf-sell-ratio"
          min="10" max="100" step="5" value="${pct}">
      </div>
    `);
    }

    return `
    <div class="sf-filter-panel">
      <div class="sf-filter-header"><i class="fas fa-filter"></i>Filters</div>
      <button class="sf-filter-reset" id="sf-filter-reset">
        <i class="fas fa-times"></i> Clear All Filters
      </button>
      ${groups}
    </div>`;
  }

  _filterGroup(key, label, content, hasActive = false) {
    const collapsed = this._filterCollapsed[key] ? " collapsed" : "";
    const hidden    = this._filterCollapsed[key] ? " hidden" : "";
    // Botão Clear aparece apenas se o grupo tem algum filtro ativo
    const clearBtn  = hasActive
      ? `<button class="sf-group-clear" data-clear-group="${key}" title="Clear this filter"><i class="fas fa-times"></i></button>`
      : "";
    return `
    <div class="sf-filter-group">
      <div class="sf-filter-group-title${collapsed}" data-collapse="${key}">
        <i class="fas fa-chevron-down"></i>
        <span class="sf-group-label">${label}</span>
        ${clearBtn}
      </div>
      <div class="sf-filter-body${hidden}" data-collapse-body="${key}">
        ${content}
      </div>
    </div>`;
  }

  // ── _renderItems ──────────────────────────────────────

  async _renderItems() {
    this._loading = true;
    const container = this.element.find("#sf-item-list-container");
    if (!container.length) return;

    container.html(`<div class="sf-shop-loading">
      <i class="fas fa-circle-notch sf-spinner"></i>
      <span>Loading…</span></div>`);

    const all      = await this._loadCompendiumItems();
    const filtered = this._applyFilters(all);
    const total    = filtered.length;
    const pages    = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (this._page >= pages) this._page = 0;

    const slice = filtered.slice(this._page * PAGE_SIZE, (this._page + 1) * PAGE_SIZE);

    if (slice.length === 0) {
      container.html(`<div class="sf-shop-empty">
        <i class="fas fa-box-open"></i>
        <span>No items found.</span></div>`);
    } else {
      container.html(slice.map(i => this._renderItemRow(i)).join(""));
    }

    this._updatePagination(this._page, pages, total);
    this._updateFooter();
    this._loading = false;
  }

  // ── _getItemProfBadge / _rankBadge ───────────────────

  /**
   * Returns { abbr, color, label } for the most relevant proficiency badge,
   * based on the item's traits matched against the actor's skills/saves.
   * Returns null if no match is found. Never throws.
   */
  _getItemProfBadge(item) {
    try {
      const actor = this.actor;
      const traits = (item.traits ?? []).map(t => (typeof t === "string" ? t : (t.value ?? "")));

      const skillMap = {
        acrobatics: "acrobatics", arcana: "arcana", athletics: "athletics",
        computers: "computers", crafting: "crafting", deception: "deception",
        diplomacy: "diplomacy", intimidation: "intimidation", medicine: "medicine",
        nature: "nature", occultism: "occultism", performance: "performance",
        piloting: "piloting", religion: "religion", society: "society",
        stealth: "stealth", survival: "survival", thievery: "thievery"
      };

      // 1. Match via item traits → actor skill
      for (const t of traits) {
        const skillKey = skillMap[t];
        if (skillKey && actor.system.skills?.[skillKey] !== undefined) {
          const rank = actor.system.skills[skillKey].rank ?? 0;
          return this._rankBadge(skillKey, rank);
        }
      }

      // 2. Fallback by item type → relevant save
      const saveMap = { armor: "reflex", shield: "reflex", weapon: "athletics" };
      const saveKey = saveMap[item.type];
      if (saveKey) {
        const src = actor.system.saves?.[saveKey] ?? actor.system.skills?.[saveKey];
        if (src !== undefined) {
          const rank = src.rank ?? 0;
          return this._rankBadge(saveKey, rank);
        }
      }

      return null;
    } catch { return null; }
  }

  _rankBadge(label, rank) {
    const ABBR   = ["U", "T", "E", "M", "L"];
    const COLORS = ["#6b7280", "#39d353", "#60a5fa", "#c084fc", "#facc15"];
    const abbr  = ABBR[rank]   ?? "U";
    const color = COLORS[rank] ?? COLORS[0];
    return { abbr, color, label: label.charAt(0).toUpperCase() + label.slice(1) };
  }

  // ── _renderItemRow ────────────────────────────────────

  _renderItemRow(i) {
    const isSell = this._compendium === "sell";
    const rarity = i.rarity ?? "common";
    const rarityClass = `sf-rarity-${rarity}`;

    const ownedCount = this.actor.items
      .filter(it => it.name.toLowerCase() === i.name.toLowerCase())
      .reduce((sum, it) => sum + (it.system?.quantity ?? 1), 0);

    const ownedBadge = ownedCount > 0
      ? `<span class="sf-owned-badge" title="In inventory: ${ownedCount}">×${ownedCount}</span>`
      : `<span class="sf-owned-empty">—</span>`;

    const priceDisplay = i.price > 0
      ? `${i.price.toLocaleString()}<span class="sf-cr">cr</span>`
      : "—";

    const sellPrice = i.price > 0
      ? Math.floor(i.price * this._sellRatio)
      : 0;

    // Botões
    const viewBtn = i.uuid
      ? `<button class="sf-action-btn" data-view-uuid="${i.uuid}" title="View Item Sheet">
           <i class="fas fa-external-link-alt"></i></button>`
      : "";

    const compendiumBtn = i.uuid
      ? `<button class="sf-action-btn" data-compendium-uuid="${i.uuid}" title="Open in Compendium">
           <i class="fas fa-book-atlas"></i></button>`
      : "";

    const actionBtn = isSell
      ? `<button class="sf-action-btn sf-sell" data-action-btn="sell"
           data-sell-id="${i.actorId ?? ""}"
           data-sell-price="${sellPrice}"
           data-sell-name="${i.name}"
           title="Sell for ${sellPrice.toLocaleString()} cr">
           <i class="fas fa-hand-holding-usd"></i></button>`
      : `<button class="sf-action-btn sf-buy" data-action-btn="buy"
           data-buy-uuid="${i.uuid ?? ""}"
           data-buy-price="${i.price}"
           data-buy-name="${i.name}"
           data-buy-type="${i.type}"
           title="Buy for ${i.price.toLocaleString()} cr">
           <i class="fas fa-coins"></i></button>`;

    const profBadge = this._getItemProfBadge(i);
    const profBadgeHtml = profBadge
      ? `<span class="sf-prof-badge" style="--sf-badge-color:${profBadge.color}" title="${profBadge.label}">${profBadge.abbr}</span>`
      : "";

    return `
    <div class="sf-item-row" data-item-uuid="${i.uuid ?? ""}">
      <span class="sf-rarity-dot ${rarityClass}" title="${rarity}"></span>
      <div class="sf-item-img-wrap">
        <img class="sf-item-img" src="${i.img}" alt=""
          onerror="this.src='icons/svg/item-bag.svg'">
        ${profBadgeHtml}
      </div>
      <div class="sf-item-name" title="${i.name}">${i.name}</div>
      <div class="sf-item-level">${i.level ?? "—"}</div>
      <div class="sf-item-price">${priceDisplay}</div>
      <div class="sf-item-owned">${ownedBadge}</div>
      <div class="sf-item-actions">
        ${viewBtn}${compendiumBtn}${actionBtn}
      </div>
    </div>`;
  }

  // ── _renderPagination ─────────────────────────────────

  _renderPagination(page, pages, total = 0) {
    return `
    <div class="sf-pagination">
      <button class="sf-page-btn" id="sf-page-prev" ${page <= 0 ? "disabled" : ""}>
        <i class="fas fa-chevron-left"></i> Prev
      </button>
      <span id="sf-page-info">${pages > 0 ? `${page + 1} / ${pages}` : "—"}</span>
      <button class="sf-page-btn" id="sf-page-next" ${page >= pages - 1 ? "disabled" : ""}>
        Next <i class="fas fa-chevron-right"></i>
      </button>
    </div>`;
  }

  _updatePagination(page, pages, total) {
    const el = this.element;
    el.find("#sf-page-prev").prop("disabled", page <= 0);
    el.find("#sf-page-next").prop("disabled", page >= pages - 1);
    el.find("#sf-page-info").text(pages > 0 ? `${page + 1} / ${pages} (${total})` : "—");
  }

  // ── _renderFooter ─────────────────────────────────────

  _renderFooter() {
    const credits = readCredits(this.actor) ?? 0;
    return `
    <div class="sf-shop-footer">
      <span class="sf-credits-display">
        <i class="fas fa-coins"></i>${credits.toLocaleString()} Credits
      </span>
      <span class="sf-footer-info" id="sf-footer-info">
        ${this.actor.name}
      </span>
    </div>`;
  }

  _updateFooter() {
    const credits = readCredits(this.actor) ?? 0;
    this.element.find(".sf-credits-display")
      .html(`<i class="fas fa-coins"></i>${credits.toLocaleString()} Credits`);
  }

  // ── _loadCompendiumItems ──────────────────────────────

  async _loadCompendiumItems() {
    const key = this._compendium;
    if (key === "sell") return this._getSellItems();
    if (this._cache.has(key)) {
      this._updateOwnedStatus(this._cache.get(key));
      return this._cache.get(key);
    }

    const compDef = COMPENDIUMS[key];
    if (!compDef?.pack) return [];

    const pack = game.packs.get(compDef.pack);
    if (!pack) {
      debugLog(`Shop | Pack not found: ${compDef.pack}`);
      ui.notifications?.warn(`SF2e Shop | Pack '${compDef.pack}' not found.`);
      return [];
    }

    let rawDocs;
    try {
      rawDocs = await pack.getDocuments();
    } catch (err) {
      debugLog(`Shop | Error loading pack ${compDef.pack}:`, err);
      return [];
    }
    debugLog(`Shop | Loaded ${rawDocs.length} docs from ${compDef.pack}`);

    // For "features" tab: entries with category "class" are Class Features.
    // For "feats" tab: everything else (ancestry, skill, bonus, general, etc.).
    // Both tabs use the same pack (sf2e.feats) and type (feat) — split is by system.category only.
    const FEATURE_CATEGORIES = new Set(["class"]);

    let filteredDocs;
    if (key === "features") {
      filteredDocs = rawDocs.filter(d => {
        if (d.type !== "feat") return false;
        return FEATURE_CATEGORIES.has(d.system?.category ?? "");
      });
    } else if (key === "feats") {
      filteredDocs = rawDocs.filter(d => {
        if (d.type !== "feat") return false;
        return !FEATURE_CATEGORIES.has(d.system?.category ?? "");
      });
    } else {
      filteredDocs = rawDocs.filter(d => !compDef.types.length || compDef.types.includes(d.type));
    }

    const items = filteredDocs.map(i => this._mapDoc(i));

    // Collect unique traits and sources
    const traitSet  = new Set();
    const sourceSet = new Set();
    for (const i of items) {
      (i.allTraits ?? []).forEach(t => traitSet.add(t));
      if (i.source) sourceSet.add(i.source);
    }
    this._allTraits  = [...traitSet].sort();
    this._allSources = [...sourceSet].sort();

    this._updateOwnedStatus(items);
    this._cache.set(key, items);
    return items;
  }

  // ── _mapDoc ───────────────────────────────────────────

  _mapDoc(doc) {
    const s = doc.system ?? {};

    // Preço em créditos (SF2e)
    const price = Number(
      s.price?.value?.credits ??
      s.price?.value ??
      0
    );

    const allTraits = [
      ...(s.traits?.value ?? []),
      ...(s.traits?.rarity ? [s.traits.rarity] : []),
    ].map(t => String(t).toLowerCase());

    const rarity = s.traits?.rarity ?? "common";

    // actionType: SF2e uses system.actionType.value = "action" | "free" | "passive" | "reaction"
    const actionType = s.actionType?.value ?? "";

    // weaponCategory: system.category = "simple" | "martial" | "advanced" | "unarmed"
    const weaponCategory = s.category ?? "";

    // weaponGroup: system.group = "axe" | "sword" | "firearm" | ...
    const weaponGroup = s.group ?? "";

    // armorCategory: system.category for armor items
    const armorCategory = doc.type === "armor" ? (s.category ?? "") : "";

    // featCategory: system.category for feats/features (ancestry, class, skill, etc.)
    const featCategory = (doc.type === "feat" || doc.type?.includes("feature"))
      ? (s.category ?? "")
      : "";

    // skill: system.skills for skill feats — can be an array or single string
    const skill = Array.isArray(s.skills)
      ? s.skills.map(sk => String(sk).toLowerCase())
      : (s.skills ? [String(s.skills).toLowerCase()] : []);

    // familiarAbility: true if this action is a Familiar Ability category entry
    const familiarAbility = (doc.type === "action" && s.category === "familiar") ||
      (allTraits.includes("familiar"));

    return {
      uuid:           doc.uuid,
      name:           doc.name,
      img:            doc.img ?? "icons/svg/item-bag.svg",
      type:           doc.type,
      level:          s.level?.value ?? null,
      bulk:           s.bulk?.value ?? null,
      rarity,
      traits:         allTraits.slice(0, 6),
      allTraits,
      price,
      source:         s.publication?.title ?? s.source?.value ?? "",
      actorHas:       false,
      description:    s.description?.value ?? "",
      // Type-specific fields
      weaponCategory,
      weaponGroup,
      armorCategory,
      actionType,
      familiarAbility,
      featCategory,
      skill,
      school:         s.school?.value ?? "",
      tradition:      s.traditions?.value ?? [],
    };
  }

  // ── _getSellItems ─────────────────────────────────────

  _getSellItems() {
    return this.actor.items
      .filter(i => SELLABLE_TYPES.includes(i.type))
      .map(i => {
        const s = i.system ?? {};
        const price = Number(
          s.price?.value?.credits ?? s.price?.value ?? 0
        );
        return {
          uuid:    i.uuid,
          actorId: i.id,
          name:    i.name,
          img:     i.img ?? "icons/svg/item-bag.svg",
          type:    i.type,
          level:   s.level?.value ?? null,
          rarity:  s.traits?.rarity ?? "common",
          traits:  (s.traits?.value ?? []).slice(0, 6),
          allTraits: s.traits?.value ?? [],
          price,
          source:  s.publication?.title ?? "",
          actorHas: true,
        };
      });
  }

  // ── _updateOwnedStatus ────────────────────────────────

  _updateOwnedStatus(items) {
    const actorNames = new Set(
      this.actor.items.map(i => i.name.toLowerCase())
    );
    for (const i of items) {
      i.actorHas = actorNames.has(i.name.toLowerCase());
    }
  }

  // ── _applyFilters ─────────────────────────────────────

  _applyFilters(list) {
    const f = this._filters;
    const q = this._search.toLowerCase().trim();

    let result = list.filter(i => {
      // Busca por texto
      if (q && !i.name.toLowerCase().includes(q)) return false;

      // Raridade
      if (f.rarity.length && !f.rarity.includes(i.rarity)) return false;

      // Traits (All of above = AND, Any of above = OR)
      if (f.traits.length) {
        const itemTraits = i.allTraits ?? [];
        if (f.traitMode === "any") {
          if (!f.traits.some(t => itemTraits.includes(t))) return false;
        } else {
          if (!f.traits.every(t => itemTraits.includes(t))) return false;
        }
      }

      // Sources
      if (f.sources.length && !f.sources.includes(i.source)) return false;

      // Level
      if (f.levelMin !== null && (i.level ?? 0) < f.levelMin) return false;
      if (f.levelMax !== null && (i.level ?? 0) > f.levelMax) return false;

      // Price
      if (f.priceMin !== null && i.price < f.priceMin) return false;
      if (f.priceMax !== null && i.price > f.priceMax) return false;

      // Inventory Types (Equipment)
      if (f.inventoryTypes.length && !f.inventoryTypes.includes(i.type)) return false;

      // Weapon Category (Simple/Martial/Advanced/Unarmed)
      if (f.weaponCategories.length && !f.weaponCategories.includes(i.weaponCategory)) return false;

      // Weapon Group (axe/sword/firearm...)
      if (f.weaponGroups.length && !f.weaponGroups.includes(i.weaponGroup)) return false;

      // Armor Category
      if (f.armorCategories.length && !f.armorCategories.includes(i.armorCategory)) return false;

      // Action Type (Abilities)
      if (f.actionTypes.length && !f.actionTypes.includes(i.actionType)) return false;

      // Familiar Ability (Abilities) — filters to only familiar-category actions
      if (f.familiarAbility && !i.familiarAbility) return false;

      // Categories (Feats / Features)
      if (f.featCategories.length && !f.featCategories.includes(i.featCategory)) return false;

      // Skills (Feats / Features — Skill Feats)
      if (f.skills.length && !f.skills.some(sk => (i.skill ?? []).includes(sk))) return false;

      return true;
    });

    // Ordenação
    const dir = this._sortDir === "asc" ? 1 : -1;
    result.sort((a, b) => {
      switch (this._sortBy) {
        case "level":  return dir * ((a.level ?? -1) - (b.level ?? -1));
        case "price":  return dir * (a.price - b.price);
        case "rarity": {
          const order = { common: 0, uncommon: 1, rare: 2, unique: 3 };
          return dir * ((order[a.rarity] ?? 0) - (order[b.rarity] ?? 0));
        }
        default: return dir * a.name.localeCompare(b.name);
      }
    });

    return result;
  }

  // ── activateListeners ─────────────────────────────────

  activateListeners(html) {
    super.activateListeners(html);

    // Carregar itens após render
    this._renderItems();

    // ── Abas ──
    html.on("click", ".sf-comp-tab", async e => {
      const key = e.currentTarget.dataset.comp;
      if (key === this._compendium) return;
      this._compendium = key;
      this._page       = 0;
      this._filters    = blankFilters();
      this._search     = "";
      this._traitSearch = "";
      this._allTraits  = [];
      this._allSources = [];
      html.find(".sf-comp-tab").removeClass("active");
      $(e.currentTarget).addClass("active");
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // ── Busca ──
    let searchTimer;
    html.on("input", ".sf-search-input", e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        this._search = e.target.value;
        this._page = 0;
        await this._renderItems();
      }, 300);
    });

    // ── Ordenação ──
    html.on("change", "#sf-sort-by", async e => {
      this._sortBy = e.target.value;
      this._page = 0;
      await this._renderItems();
    });
    html.on("click", "#sf-sort-dir", async () => {
      this._sortDir = this._sortDir === "asc" ? "desc" : "asc";
      html.find("#sf-sort-dir i")
        .attr("class", `fas fa-sort-amount-${this._sortDir === "asc" ? "up" : "down"}`);
      this._page = 0;
      await this._renderItems();
    });

    // ── Paginação ──
    html.on("click", "#sf-page-prev", async () => {
      if (this._page > 0) { this._page--; await this._renderItems(); }
    });
    html.on("click", "#sf-page-next", async () => {
      this._page++;
      await this._renderItems();
    });

    // ── Filtros: checkbox genérico ──────────────────────────────
    // Rarity
    html.on("change", "input[data-filter='rarity']", async e => {
      const val = e.target.value;
      if (e.target.checked) { if (!this._filters.rarity.includes(val)) this._filters.rarity.push(val); }
      else { this._filters.rarity = this._filters.rarity.filter(r => r !== val); }
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // Traits
    html.on("change", "input[data-filter='traits']", async e => {
      const val = e.target.value;
      if (e.target.checked) { if (!this._filters.traits.includes(val)) this._filters.traits.push(val); }
      else { this._filters.traits = this._filters.traits.filter(t => t !== val); }
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // Trait mode (All / Any)
    html.on("change", "input[name='sf-trait-mode']", async e => {
      this._filters.traitMode = e.target.value;
      this._page = 0;
      await this._renderItems();
    });

    // Sources
    html.on("change", "input[data-filter='sources']", async e => {
      const val = e.target.value;
      if (e.target.checked) { if (!this._filters.sources.includes(val)) this._filters.sources.push(val); }
      else { this._filters.sources = this._filters.sources.filter(s => s !== val); }
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // Inventory Types
    html.on("change", "input[data-filter='inventoryTypes']", async e => {
      const val = e.target.value;
      if (e.target.checked) { if (!this._filters.inventoryTypes.includes(val)) this._filters.inventoryTypes.push(val); }
      else { this._filters.inventoryTypes = this._filters.inventoryTypes.filter(v => v !== val); }
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // Weapon Categories
    html.on("change", "input[data-filter='weaponCategories']", async e => {
      const val = e.target.value;
      if (e.target.checked) { if (!this._filters.weaponCategories.includes(val)) this._filters.weaponCategories.push(val); }
      else { this._filters.weaponCategories = this._filters.weaponCategories.filter(v => v !== val); }
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // Weapon Groups
    html.on("change", "input[data-filter='weaponGroups']", async e => {
      const val = e.target.value;
      if (e.target.checked) { if (!this._filters.weaponGroups.includes(val)) this._filters.weaponGroups.push(val); }
      else { this._filters.weaponGroups = this._filters.weaponGroups.filter(v => v !== val); }
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // Armor Categories
    html.on("change", "input[data-filter='armorCategories']", async e => {
      const val = e.target.value;
      if (e.target.checked) { if (!this._filters.armorCategories.includes(val)) this._filters.armorCategories.push(val); }
      else { this._filters.armorCategories = this._filters.armorCategories.filter(v => v !== val); }
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // Action Types
    html.on("change", "input[data-filter='actionTypes']", async e => {
      const val = e.target.value;
      if (e.target.checked) { if (!this._filters.actionTypes.includes(val)) this._filters.actionTypes.push(val); }
      else { this._filters.actionTypes = this._filters.actionTypes.filter(v => v !== val); }
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // Familiar Ability (checkbox — single toggle)
    html.on("change", "input[data-filter='familiarAbility']", async e => {
      this._filters.familiarAbility = e.target.checked;
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // Feat Categories (Feats / Features)
    html.on("change", "input[data-filter='featCategories']", async e => {
      const val = e.target.value;
      if (e.target.checked) { if (!this._filters.featCategories.includes(val)) this._filters.featCategories.push(val); }
      else { this._filters.featCategories = this._filters.featCategories.filter(v => v !== val); }
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // Skills (Feats / Features)
    html.on("change", "input[data-filter='skills']", async e => {
      const val = e.target.value;
      if (e.target.checked) { if (!this._filters.skills.includes(val)) this._filters.skills.push(val); }
      else { this._filters.skills = this._filters.skills.filter(v => v !== val); }
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // ── Filtros: ranges ──
    html.on("change", "#sf-level-min", async e => {
      this._filters.levelMin = e.target.value !== "" ? Number(e.target.value) : null;
      this._page = 0; await this._renderItems();
    });
    html.on("change", "#sf-level-max", async e => {
      this._filters.levelMax = e.target.value !== "" ? Number(e.target.value) : null;
      this._page = 0; await this._renderItems();
    });
    html.on("change", "#sf-price-min", async e => {
      this._filters.priceMin = e.target.value !== "" ? Number(e.target.value) : null;
      this._page = 0; await this._renderItems();
    });
    html.on("change", "#sf-price-max", async e => {
      this._filters.priceMax = e.target.value !== "" ? Number(e.target.value) : null;
      this._page = 0; await this._renderItems();
    });

    // ── Clear por grupo ──────────────────────────────────────────
    html.on("click", "[data-clear-group]", async e => {
      e.stopPropagation(); // evita que o collapse do grupo dispare
      const group = e.currentTarget.dataset.clearGroup;
      switch (group) {
        case "traits":          this._filters.traits = []; this._traitSearch = ""; break;
        case "rarity":          this._filters.rarity = []; break;
        case "inventoryTypes":  this._filters.inventoryTypes = []; break;
        case "weaponFilters":   this._filters.weaponCategories = []; this._filters.weaponGroups = []; break;
        case "armorCategories": this._filters.armorCategories = []; break;
        case "actionTypes":     this._filters.actionTypes = []; break;
        case "familiarAbility": this._filters.familiarAbility = false; break;
        case "featCategories":  this._filters.featCategories = []; break;
        case "skills":          this._filters.skills = []; break;
        case "level":           this._filters.levelMin = null; this._filters.levelMax = null; break;
        case "price":           this._filters.priceMin = null; this._filters.priceMax = null; break;
        case "sources":         this._filters.sources = []; break;
      }
      this._page = 0;
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // ── Trait search ──
    let traitTimer;
    html.on("input", "#sf-trait-search", e => {
      clearTimeout(traitTimer);
      traitTimer = setTimeout(async () => {
        this._traitSearch = e.target.value;
        await this._reRenderFilterPanel(html);
      }, 200);
    });

    // ── Sell ratio slider ──
    html.on("input", "#sf-sell-ratio", e => {
      this._sellRatio = Number(e.target.value) / 100;
      html.find("#sf-sell-ratio-val").text(`${e.target.value}%`);
    });
    html.on("change", "#sf-sell-ratio", async () => {
      this._page = 0; await this._renderItems();
    });

    // ── Clear all filters ──
    html.on("click", "#sf-filter-reset", async () => {
      this._filters    = blankFilters();
      this._search     = "";
      this._traitSearch = "";
      this._page       = 0;
      html.find(".sf-search-input").val("");
      await this._reRenderFilterPanel(html);
      await this._renderItems();
    });

    // ── Collapse filter groups ──
    html.on("click", "[data-collapse]", e => {
      const key = e.currentTarget.dataset.collapse;
      this._filterCollapsed[key] = !this._filterCollapsed[key];
      $(e.currentTarget).toggleClass("collapsed", !!this._filterCollapsed[key]);
      html.find(`[data-collapse-body="${key}"]`).toggleClass("hidden", !!this._filterCollapsed[key]);
    });

    // ── View Item Sheet (openSheet equivalent) ──
    html.on("click", "[data-view-uuid]", async e => {
      e.preventDefault();
      e.stopPropagation();
      const uuid = e.currentTarget.dataset.viewUuid;
      if (!uuid) return;
      try {
        const item = await fromUuid(uuid);
        item?.sheet?.render(true);
      } catch (err) {
        debugLog("Shop | openSheet error:", err);
      }
    });

    // ── Open in Compendium (activateEntry equivalent) ──
    html.on("click", "[data-compendium-uuid]", async e => {
      e.preventDefault();
      e.stopPropagation();
      const uuid = e.currentTarget.dataset.compendiumUuid;
      if (!uuid) return;
      try {
        const item = await fromUuid(uuid);
        if (item?.compendium) {
          const pack = item.compendium;
          await pack.render(true);
          pack.activate?.();
        } else if (item) {
          item.sheet?.render(true);
        }
      } catch (err) {
        debugLog("Shop | activateEntry error:", err);
        ui.notifications?.warn("Could not open compendium entry.");
      }
    });

    // ── Buy ──
    html.on("click", "[data-action-btn='buy']", async e => {
      e.stopPropagation();
      const btn     = e.currentTarget;
      const uuid    = btn.dataset.buyUuid;
      const price   = Number(btn.dataset.buyPrice);
      const name    = btn.dataset.buyName;
      const type    = btn.dataset.buyType;
      await this._buyItem(uuid, price, name, type);
    });

    // ── Sell ──
    html.on("click", "[data-action-btn='sell']", async e => {
      e.stopPropagation();
      const btn      = e.currentTarget;
      const actorId  = btn.dataset.sellId;
      const price    = Number(btn.dataset.sellPrice);
      const name     = btn.dataset.sellName;
      await this._sellItem(actorId, price, name);
    });
  }

  // ── _reRenderFilterPanel ──────────────────────────────

  async _reRenderFilterPanel(html) {
    const panel = html.find(".sf-filter-panel");
    panel.replaceWith(this._renderFilterPanel());
  }

  // ── _buyItem ──────────────────────────────────────────

  async _buyItem(uuid, price, name, type) {
    if (!uuid) { toast("Item UUID missing.", "error"); return; }
    const credits = readCredits(this.actor) ?? 0;

    if (price > 0 && credits < price) {
      ui.notifications.warn(`Insufficient credits. Need ${price.toLocaleString()} cr, have ${credits.toLocaleString()} cr.`);
      await warnAlert({
        message: `Insufficient Credits for "${name}"`,
        details: [
          `<strong>SUBJECT:</strong> ${this.actor.name}`,
          `<strong>ASSET:</strong> ${name}`,
          `<strong>REQUIRED:</strong> <span style="font-size:1.2em; color:#facc15;">${price.toLocaleString()} Credits</span>`,
          `<strong>CURRENT:</strong> <span style="font-size:1.2em; color:#ff4444;">${credits.toLocaleString()} Credits</span>`,
        ],
        actor: this.actor,
      });
      return;
    }

    try {
      const sourceItem = await fromUuid(uuid);
      if (!sourceItem) throw new Error("Item not found.");

      // Adicionar item ao ator
      await this._addItemToActor(sourceItem, type);

      // Deduzir créditos
      if (price > 0) {
        await deductCredits(this.actor, price);
      }

      // Log de transação
      await this._logTransaction("buy", name, price);

      toast(`Purchased: ${name}${price > 0 ? ` (−${price.toLocaleString()} cr)` : ""}`, "success");
      debugLog(`Shop | Bought "${name}" for ${price} cr`);

      // Atualizar owned status no cache
      const cached = this._cache.get(this._compendium);
      if (cached) this._updateOwnedStatus(cached);

      await this._renderItems();
      this._updateFooter();
    } catch (err) {
      debugLog("Shop | _buyItem error:", err);
      toast(`Purchase failed: ${err.message}`, "error");
    }
  }

  // ── _addItemToActor ───────────────────────────────────

  async _addItemToActor(sourceItem, type) {
    const itemData = sourceItem.toObject();
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  // ── _sellItem ─────────────────────────────────────────

  async _sellItem(actorId, price, name) {
    if (!actorId) { toast("Item ID missing.", "error"); return; }
    const item = this.actor.items.get(actorId);
    if (!item) { toast("Item not found in inventory.", "error"); return; }

    try {
      const qty = item.system?.quantity ?? 1;
      if (qty > 1) {
        // Diminuir quantidade em vez de remover
        await item.update({ "system.quantity": qty - 1 });
      } else {
        await item.delete();
      }

      if (price > 0) {
        await addCredits(this.actor, price);
      }

      await this._logTransaction("sell", name, price);
      toast(`Sold: ${name}${price > 0 ? ` (+${price.toLocaleString()} cr)` : ""}`, "success");
      debugLog(`Shop | Sold "${name}" for ${price} cr`);

      await this._renderItems();
      this._updateFooter();
    } catch (err) {
      debugLog("Shop | _sellItem error:", err);
      toast(`Sale failed: ${err.message}`, "error");
    }
  }

  // ── _logTransaction ───────────────────────────────────

  async _logTransaction(type, name, amount) {
    const action  = type === "buy" ? "Purchased" : "Sold";
    const sign    = type === "buy" ? "−" : "+";
    const message = `[SF2e Shop] ${action}: <strong>${name}</strong>${amount > 0 ? ` | ${sign}${amount.toLocaleString()} cr` : ""}`;

    // Chat message
    ChatMessage.create({
      content: message,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    });

    // Journal log — assinatura correta: objeto nomeado conforme journal-log.js
    if (typeof appendTransactionLog === "function") {
      const balanceAfter = readCredits(this.actor);
      await appendTransactionLog({
        actorName:    this.actor.name,
        type:         type === "buy" ? "COMPRA" : "VENDA",
        itemName:     name,
        qty:          1,
        credits:      amount,
        balanceAfter,
      }).catch(() => {});
    }
  }

  // ── close ─────────────────────────────────────────────

  async close(options = {}) {
    this._cache.clear();
    return super.close(options);
  }
}

// ─── Alias de compatibilidade ──────────────────────────────

export class SF2eShopSellApplication extends SF2eShopBuyApplication {
  constructor(actor, options = {}) {
    super(actor, options);
    this._compendium = "sell";
  }
}