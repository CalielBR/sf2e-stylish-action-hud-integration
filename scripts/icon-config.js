/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║              ICON CONFIGURATION — SF2E Stylish Bridge               ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  HOW TO CHANGE AN ICON:                                             ║
 * ║                                                                      ║
 * ║  Edit ONLY the value to the RIGHT of the colon (:)                  ║
 * ║  The new file must exist in:                                         ║
 * ║     assets/icons/actions-symbols/SEU-ARQUIVO.svg                   ║
 * ║                                                                      ║
 * ║  Example:                                                            ║
 * ║    'strike': 'strike',           ← uses strike.svg (default)       ║
 * ║    'strike': 'my-custom-sword',  ← uses my-custom-sword.svg        ║
 * ║                                                                      ║
 * ║  ⚠  DO NOT change the KEY (left side) — the system uses it         ║
 * ║     internally and functionality will break if altered.             ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * LEGEND:
 *   [ENCOUNTER]   → Encounter Tab (turn-based combat)
 *   [EXPLORATION] → Exploration / Downtime Tab
 *   [INVENTORY]   → Inventory Menu → Category tabs
 *   [MENU BUTTON] → Button on the main HUD (action bar)
 *   [UI/CHECKS]   → Checks Tab (Saves, Skills, Triggers, Dying, Rest)
 *   [SF2e]        → Exclusive to Starfinder 2e
 */

import { SF2E_CUSTOM_ICONS } from './icon-config-custom.js';

/** Base mapping for icons provided by the module. */
const BASE_ICONS = {
  // ════════════════════════════════════════════════════════════════════
  // ⚔  COMBAT ACTIONS (Offensive)
  //    Appears in: Encounter → Attacks & Maneuvers
  // ════════════════════════════════════════════════════════════════════
  //  KEY (do not change)         SVG FILE (edit here ↓)
  'strike':               'strike',              // [ENCOUNTER]   Basic attack
  'disarm':               'disarm',              // [ENCOUNTER]   Disarm enemy
  'grapple':              'grapple',             // [ENCOUNTER]   Grapple and immobilize
  'shove':                'shove',               // [ENCOUNTER]   Shove enemy
  'trip':                 'trip',                // [ENCOUNTER]   Trip enemy (prone)
  'reposition':           'reposition',          // [ENCOUNTER]   Reposition enemy
  'feint':                'feint',               // [ENCOUNTER]   Feint, reduce AC
  'escape':               'escape',              // [ENCOUNTER]   Escape from grapple/immobilization
  'area-fire':            'area-fire',           // [SF2e]        Area-fire (burst)
  'auto-fire':            'auto-fire',           // [SF2e]        Auto-fire mode

  // ════════════════════════════════════════════════════════════════════
  // 🏃  COMBAT ACTIONS (Movement)
  //    Appears in: Encounter → Movement
  // ════════════════════════════════════════════════════════════════════
  'stride':               'stride',              // [ENCOUNTER]   Move up to Speed
  'step':                 'step',                // [ENCOUNTER]   Move 5ft without reactions
  'stand':                'stand',               // [ENCOUNTER]   Stand up from prone
  'leap':                 'leap',                // [ENCOUNTER]   Jump over obstacles
  'crawl':                'crawl',               // [ENCOUNTER]   Move while prone
  'fly':                  'fly',                 // [ENCOUNTER]   Move through air
  'burrow':               'burrow',              // [ENCOUNTER]   Move through earth
  'mount':                'mount',               // [ENCOUNTER]   Mount or dismount creature
  'push-off':             'push-off',            // [SF2e]        Push off in zero-G

  // ════════════════════════════════════════════════════════════════════
  // 🛡  COMBAT ACTIONS (Defense & Support)
  //    Appears in: Encounter → Defense & Support
  // ════════════════════════════════════════════════════════════════════
  'seek':                 'seek',                // [ENCOUNTER]   Search for hidden enemies
  'sense-motive':         'sense-motive',        // [ENCOUNTER]   Detect deception or intent
  'interact':             'interact',            // [ENCOUNTER]   Use or manipulate object
  'take-cover':           'take-cover',          // [ENCOUNTER]   Hide behind cover for AC
  'raise-a-shield':       'raise-a-shield',      // [ENCOUNTER]   Raise shield for AC
  'avert-gaze':           'avert-gaze',          // [ENCOUNTER]   Avert gaze from visual effect
  'ready':                'ready',               // [ENCOUNTER]   Ready a reaction
  'delay':                'delay',               // [ENCOUNTER]   Act later in the turn
  'release':              'release',             // [ENCOUNTER]   Release item or hold
  'point-out':            'point-out',           // [ENCOUNTER]   Reveal hidden enemy
  'dismiss':              'dismiss',             // [ENCOUNTER]   End spell or effect
  'sustain':              'sustain',             // [ENCOUNTER]   Keep spell active
  'repeat-a-spell':       'repeat-a-spell',      // [EXPLORATION] Cast spell again (exploration)
  'aid':                  'aid',                 // [ENCOUNTER]   Aid ally on next action

  // ════════════════════════════════════════════════════════════════════
  // 🎯  SKILL ACTIONS
  //    Appears in: Encounter → Skill Actions
  // ════════════════════════════════════════════════════════════════════
  'balance':              'balance',             // [ENCOUNTER]   Acrobatics: difficult surfaces
  'tumble-through':       'tumble-through',      // [ENCOUNTER]   Acrobatics: pass through enemy space
  'maneuver-in-flight':   'maneuver-in-flight',  // [ENCOUNTER]   Acrobatics: difficult maneuver flying
  'climb':                'climb',               // [ENCOUNTER]   Athletics: climb wall/surface
  'force-open':           'force-open',          // [ENCOUNTER]   Athletics: break open door/container
  'high-jump':            'high-jump',           // [ENCOUNTER]   Athletics: extra high jump
  'long-jump':            'long-jump',           // [ENCOUNTER]   Athletics: extra long jump
  'swim':                 'swim',                // [ENCOUNTER]   Athletics: move in water
  'recall-knowledge':     'recall-knowledge',    // [ENCOUNTER]   Various: remember info
  'disable-a-device':     'disable-a-device',    // [ENCOUNTER]   Thievery: disable trap
  'create-a-diversion':   'create-a-diversion',  // [ENCOUNTER]   Deception: distract enemies to hide
  'demoralize':           'demoralize',          // [ENCOUNTER]   Intimidation: apply Frightened
  'administer-first-aid': 'administer-first-aid',// [ENCOUNTER]   Medicine: stabilize or stop bleeding
  'treat-poison':         'treat-poison',        // [ENCOUNTER]   Medicine: reduce poison effects
  'command-an-animal':    'command-an-animal',   // [ENCOUNTER]   Nature: command animal companion
  'perform':              'perform',             // [ENCOUNTER]   Performance: entertain or distract
  'hide':                 'hide',                // [ENCOUNTER]   Stealth: become hidden
  'sneak':                'sneak',               // [ENCOUNTER]   Stealth: move silently hidden
  'steal':                'steal',               // [ENCOUNTER]   Thievery: take item unnoticed

  // ════════════════════════════════════════════════════════════════════
  // 🚀  STARFINDER SPECIALTY
  //    Appears in: Encounter → Skill Actions (SF2e exclusive)
  // ════════════════════════════════════════════════════════════════════
  'drive':                'drive',               // [SF2e]        Piloting: control vehicle
  'stop':                 'stop',                // [SF2e]        Piloting: stop vehicle
  'stunt':                'stunt',               // [SF2e]        Piloting: vehicle maneuver
  'take-control':         'take-control',        // [SF2e]        Take control of vehicle/system
  'run-over':             'run-over',            // [SF2e]        Run over enemies with vehicle
  'recharge':             'recharge',            // [SF2e]        Recharge weapon/device energy
  'access-infosphere':    'access-infosphere',   // [SF2e]        Computers: connect to infosphere
  'hack':                 'hack',                // [SF2e]        Computers: hack digital system
  'operate-device':       'operate-device',      // [SF2e]        Operate technological device
  'livestream':           'livestream',          // [SF2e]        Publicly stream events

  // ════════════════════════════════════════════════════════════════════
  // 🗺  EXPLORATION & DOWNTIME
  //    Appears in: Exploration and Downtime tabs
  // ════════════════════════════════════════════════════════════════════
  'analyze-environment':  'analyze-environment', // [EXPLORATION] Study surrounding area
  'avoid-notice':         'avoid-notice',        // [EXPLORATION] Move unseen (Stealth)
  'defend':               'defend',              // [EXPLORATION] Focus on defense while exploring
  'detect-magic':         'detect-magic',        // [EXPLORATION] Sense magic auras while moving
  'scout':                'scout',               // [EXPLORATION] Scout ahead and alert party
  'search':               'search',              // [EXPLORATION] Actively search for traps/hidden
  'hustle':               'hustle',              // [EXPLORATION] Move at double speed (take damage)
  'follow-the-expert':    'follow-the-expert',   // [EXPLORATION] Follow skilled ally (bonus)
  'squeeze':              'squeeze',             // [EXPLORATION] Pass through very tight space
  'borrow-an-arcane-spell': 'borrow-an-arcane-spell', // [EXPLORATION] Arcana: copy spell from book
  'decipher-writing':     'decipher-writing',    // [EXPLORATION] Decode unknown text
  'identify-magic':       'identify-magic',      // [EXPLORATION] Determine properties of magic item
  'learn-a-spell':        'learn-a-spell',       // [EXPLORATION] Add new spell to repertoire
  'repair':               'repair',              // [EXPLORATION] Crafting: repair broken item
  'impersonate':          'impersonate',         // [EXPLORATION] Deception: disguise as someone else
  'gather-information':   'gather-information',  // [EXPLORATION] Diplomacy: ask for info
  'make-an-impression':   'make-an-impression',  // [EXPLORATION] Diplomacy: improve attitude
  'coerce':               'coerce',              // [EXPLORATION] Intimidation: force with threats
  'treat-wounds':         'treat-wounds',        // [EXPLORATION] Medicine: heal HP outside combat
  'navigate':             'navigate',            // [EXPLORATION] Survival: find route to destination
  'plot-course':          'plot-course',         // [SF2e]        Plot starship route
  'sense-direction':      'sense-direction',     // [EXPLORATION] Survival: know which way is north
  'cover-tracks':         'cover-tracks',        // [EXPLORATION] Survival: hide party tracks
  'track':                'track',               // [EXPLORATION] Survival: follow creature tracks
  'craft':                'craft',               // [DOWNTIME]    Crafting: manufacture items
  'earn-income':          'earn-income',         // [DOWNTIME]    Work for money
  'treat-disease':        'treat-disease',       // [DOWNTIME]    Medicine: recover from disease
  'subsist':              'subsist',             // [DOWNTIME]    Survive in wilderness
  'create-forgery':       'create-forgery',      // [DOWNTIME]    Society: create forgery

  // ════════════════════════════════════════════════════════════════════
  // 🖥  INTERFACE (Main Menu Buttons)
  //    Appears in: HUD main bar
  // ════════════════════════════════════════════════════════════════════
  'menu-action-skill':    'menu-action-skill',   // [MENU BUTTON] "Skills Action" button
  'menu-checks':          'menu-checks',         // [MENU BUTTON] "Checks" button
  'menu-feat':            'menu-feat',           // [MENU BUTTON] "Feats" button
  'menu-inventory':       'menu-inventory',      // [MENU BUTTON] "Inventory" button
  'menu-spell':           'menu-spell',          // [MENU BUTTON] "Spell" button
  'menu-shop':            'menu-shop',           // [MENU BUTTON] "Shop" button

  // ════════════════════════════════════════════════════════════════════
  // 📑  INTERFACE (Action Tab Modes)
  //    Appears in: Encounter/Exploration/Downtime switch
  // ════════════════════════════════════
  'tab-encounter':        'tab-encounters',      // [ENCOUNTER]   Rocket icon (Action Menu)
  'tab-exploration':      'tab-exploration',     // [EXPLORATION] Gear icon
  'tab-downtime':         'tab-downtime',        // [DOWNTIME]    Tool icon (Action Menu)

  // ════════════════════════════════════════════════════════════════════
  // 📂  INTERFACE (Internal Submenus)
  //    Appears in: Category headers and sidebar tabs
  // ════════════════════════════════════════════════════════════════════
  // -- Inventory Submenus --
  'submenu-ammunition':     'submenu-ammunition',  // [INVENTORY] Ammo tab
  'submenu-armor':          'submenu-armor',       // [INVENTORY] Armor tab
  'submenu-augmentations':  'submenu-augmentations',// [INVENTORY] Cybernetics tab
  'submenu-consumables':    'submenu-consumables', // [INVENTORY] Consumables tab
  'submenu-equipment':      'submenu-equipment',   // [INVENTORY] Equipment/Tools tab
  'submenu-shields':        'submenu-shields',     // [INVENTORY] Shields tab
  'submenu-treasure':       'submenu-treasure',    // [INVENTORY] Credits/Valuables tab
  'submenu-upgrades':       'submenu-upgrades',    // [INVENTORY] Upgrades/Fusions tab
  'submenu-weapons':        'submenu-weapons',     // [INVENTORY] Weapons tab
  // -- UI & Checks Submenus --
  'submenu-skills-basic':   'submenu-academics',   // [UI/CHECKS] Header: Skills sub-tab
  'submenu-dying':          'submenu-dying',       // [UI/CHECKS] Dying/Death tab
  'submenu-recovery':       'submenu-recovery',       // [UI/CHECKS] Recovery tab
  'submenu-lore-skills':    'submenu-lore-skills',         // [UI/CHECKS] Header: Lore sub-tab
  'submenu-rest':           'submenu-rest',        // [UI/CHECKS] Rest tab
  'submenu-saves':          'submenu-saves',       // [UI/CHECKS] Saving Throws tab
  'submenu-skills':         'submenu-skills',      // [UI/CHECKS] Main Skills & Lore tab
  'submenu-triggers':       'submenu-triggers',    // [UI/CHECKS] Triggers tab
  'submenu-macro':          'submenu-macro',      // [UI/CHECKS] Custom Macros tab icon

  // ════════════════════════════════════════════════════════════════════
  // 🛡  INTERFACE (Saving Throws)
  //    Appears in: Checks -> Saving Throws rows
  // ════════════════════════════════════════════════════════════════════
  'save-fortitude':       'save-fortitude',      // [UI/CHECKS]   Fortitude Saves row in Checks menu
  'save-reflex':          'save-reflex',         // [UI/CHECKS]   Reflex Saves row in Checks menu
  'save-will':            'save-will',           // [UI/CHECKS]   Will Saves row in Checks menu

  // ════════════════════════════════════════════════════════════════════
  // ⚙  INTERFACE (Miscellaneous)
  // ════════════════════════════════════════════════════════════════════
  'shop-icon':            'shop-icon',                 // [INTERFACE]   Market/Shop header icon
  'btn-damage':           'btn-damage',                // [ENCOUNTER]   Damage button (⚡) on Strike attacks
  'btn-damage-critical':  'btn-damage-critical',       // [ENCOUNTER]   Critical Damage button on Strike attacks
};

/** 
 * Combined icon mapping.
 * Merges base icons with user-defined overrides from icon-config-custom.js 
 */
export const SF2E_ICONS = { ...BASE_ICONS, ...SF2E_CUSTOM_ICONS };

/** BASE PATH para todos os ícones SVG locais. */
export const ICON_BASE_PATH = 'modules/stylish-bridge-sf2e/assets/icons/actions-symbols';

/** Retorna o caminho completo para o arquivo SVG do ícone. */
export const getIconPath = (key) => `${ICON_BASE_PATH}/${SF2E_ICONS[key] || key}.svg`;

/** Retorna o HTML inline para renderizar o ícone como máscara SVG. */
export function getIconHtml(key, { size = '1.1em', color = 'currentColor', margin = '0', extraStyle = '' } = {}) {
  const path = getIconPath(key);
  return `<span class="sf2e-local-icon" style="-webkit-mask-image: url('${path}'); mask-image: url('${path}'); width: ${size}; height: ${size}; background-color: ${color}; display: inline-block; margin: ${margin}; ${extraStyle}"></span>`;
}

/**
 * Diagnostic function to validate if SVG files exist in the assets folder.
 * Can be called from the console: StylishAction.adapter.validateIcons() 
 * or imported directly.
 */
export async function validateIcons() {
    console.log("%c SF2E Bridge | Icon Validation Starting...", "color: #c084fc; font-weight: bold;");
    let missing = 0;
    
    for (const [key, fileName] of Object.entries(SF2E_ICONS)) {
        const path = getIconPath(key);
        const exists = await srcExists(path);
        
        if (!exists) {
            console.warn(`SF2E Bridge | Icon Missing! Key: [${key}] -> Expected File: ${fileName}.svg -> Path: ${path}`);
            missing++;
        }
    }

    if (missing === 0) console.log("%c SF2E Bridge | All icons validated successfully!", "color: #00ff00; font-weight: bold;");
    else console.error(`SF2E Bridge | Validation finished. ${missing} icons are missing from the disk.`);
}