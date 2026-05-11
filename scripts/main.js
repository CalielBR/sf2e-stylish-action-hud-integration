/* scripts/main.js */
/* cspell:ignore batwings infosphere skillaction IBHUD Teko Cmoyh Spuc triforce actions */

import { Pf2eAdapter } from "./pf2e.js";
import { SF2E_ICONS, getIconHtml, getIconPath } from "./icon-config.js";
import { readCredits, deductCredits, addCredits } from "./credits-utils.js";
import { getOrCreateShopJournal, appendTransactionLog } from "./journal-log.js";
import { SF2eShopBuyApplication } from "./shop-buy.js";
import { debugLog, warnAlert } from "./debug-utils.js";

/**
 * System Adapter for Starfinder 2e
 * Acts as a bridge over the PF2e engine
 */
class Starfinder2eAdapter extends Pf2eAdapter {
    constructor() {
        super();
        this.systemId = "sf2e";
    }

    /** Official Starfinder 2e description for Treat Wounds to avoid code duplication */
    static TREAT_WOUNDS_DESCRIPTION_HTML = `
        <p><strong>Requirements</strong> You're wearing or holding a @UUID[Compendium.sf2e.equipment.Item.s1vB3HdXjMigYAnY]{medkit}.</p>
        <hr>
        <p>You spend 10 minutes treating one injured living creature (targeting yourself, if you so choose). The target is then temporarily @UUID[Compendium.sf2e.feat-effects.Item.Lb4q2bBAgxamtix5]{immune} to Treat Wounds actions for 1 hour, but this interval overlaps with the time you spent treating (so a patient can be treated once per hour, not once per 70 minutes).</p>
        <p>The Medicine check DC is usually 15, though the GM might adjust it based on the circumstances, such as treating a patient outside in a storm, or treating magically cursed wounds. If you're an expert in Medicine, you can instead attempt a DC 20 check to increase the Hit Points regained by 10; if you're a master of Medicine, you can instead attempt a DC 30 check to increase the Hit Points regained by 30; and if you're legendary, you can instead attempt a DC 40 check to increase the Hit Points regained by 50. The damage dealt on a critical failure remains the same.</p>
        <p>If you succeed at your check, you can continue treating the target to grant additional healing. If you treat it for a total of 1 hour, double the Hit Points it regains from Treat Wounds.</p>
        <p>The result of your Medicine check determines how many Hit Points the target regains.</p>
        <p>@UUID[Compendium.sf2e.macros.Macro.6duZj0Ygiqv712rq]{Treat Wounds}</p>
        <hr>
        <p><strong>Critical Success</strong> The target regains [[/r 4d8[healing] #Treat Wounds]] Hit Points and loses the @UUID[Compendium.sf2e.conditions.Item.Yl48xTdMh3aeQYL2]{Wounded} condition.</p>
        <p><strong>Success</strong> The target regains [[/r 2d8[healing] #Treat Wounds]] Hit Points, and loses the wounded condition.</p>
        <p><strong>Critical Failure</strong> The target takes [[/r 1d8[damage] #Treat Wounds (Critical Failure)]] damage.</p>
    `;

    /** List of standard skills for icon and label detection */
    static SKILL_TRAITS = [
        'acrobatics', 'arcana', 'athletics', 'computers', 'crafting', 'deception', 'diplomacy',
        'intimidation', 'medicine', 'nature', 'occultism', 'performance', 'piloting',
        'religion', 'society', 'stealth', 'survival', 'thievery'
    ];

    /**
     * Generates a rich description for the HUD tooltip, including rarity and traits,
     * similar to the logic of the Token Action HUD PF2e tooltips.
     */
    async _prepareTooltip(name, description, traits = [], rarity = null, metaTags = []) {
        if (!description && (!traits || traits.length === 0)) return "";

        // Tries to localize the description if it's a translation key (common in system actions)
        // Guard: if localize() returns the key itself, the key is not registered — use raw string as fallback
        const _safeLocalize = (key) => {
            if (!key) return "";
            const result = game.i18n.localize(key);
            return (result === key) ? "" : result;
        };
        const finalDescription = _safeLocalize(description) || description || "";

        let header = `<h3 style="border-bottom: 1px solid var(--color-border-light-2); margin-bottom: 5px; font-weight: bold;">${name}</h3>`;
        header += '<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;">';

        if (rarity) {
            const rName = rarity.name || rarity.value || (typeof rarity === 'string' ? rarity : "");
            const rLabel = rarity.label || game.i18n.localize(CONFIG.PF2E.rarityTraits[rName] || rName);
            if (rName) {
                header += `<span class="tag rarity ${rName}" style="background: var(--color-rarity-${rName}); color: white; padding: 1px 4px; border-radius: 3px; font-size: 0.85em;">${rLabel}</span>`;
            }
        }

        const traitList = Array.isArray(traits) ? traits : (traits?.value || []);
        traitList.forEach(t => {
            const traitKey = t.value || t.name || t;
            const label = t.label || game.i18n.localize(CONFIG.PF2E.actionTraits[traitKey] || traitKey);
            if (label) {
                header += `<span class="tag" style="background: rgba(255,255,255,0.1); border: 1px solid var(--color-border-dark-1); padding: 1px 4px; border-radius: 3px; font-size: 0.85em;">${label}</span>`;
            }
        });
        header += '</div>';

        // Bloco de meta-tags (Level, Uses, etc.)
        let metaHtml = "";
        if (metaTags.length > 0) {
            const tagsHtml = metaTags.map(tag =>
                `<span style="
                    background: rgba(167,139,250,0.2);
                    border: 1px solid #a78bfa;
                    color: #c084fc;
                    padding: 1px 6px;
                    border-radius: 3px;
                    font-size: 0.85em;
                    font-weight: bold;
                ">${tag}</span>`
            ).join("");
            metaHtml = `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">${tagsHtml}</div>`;
        }

        const tooltipHtml = `<div>${header}${metaHtml}<div class="description" style="font-size: 0.95em; line-height: 1.4;">${finalDescription}</div></div>`;

        // Processes the HTML to activate compendium links, action icons, and inline rolls
        return await foundry.applications.ux.TextEditor.enrichHTML(tooltipHtml, { async: true });
    }

    _getLocalizedOrDefault(key, defaultText) {
        const localized = game.i18n.localize(key);
        if (localized === key || !localized || localized.toLowerCase().includes("ibhud.")) {
            return defaultText;
        }
        return localized;
    }

    _createStrikeItem(s) {
        const item = super._createStrikeItem(s);
        item.name = item.name.replaceAll('background: rgba(50, 50, 50,', 'background: rgba(120, 46, 156,');
        item.name = item.name.replaceAll("onmouseout=\"this.style.background='rgba(50, 50, 50,", "onmouseout=\"this.style.background='rgba(120, 46, 156,");
        return item;
    }

    _createElementalBlastItem(elementalBlast, config) {
        const item = super._createElementalBlastItem(elementalBlast, config);
        item.name = item.name.replaceAll('background: rgba(50, 50, 50,', 'background: rgba(120, 46, 156,');
        item.name = item.name.replaceAll("onmouseout=\"this.style.background='rgba(50, 50, 50,", "onmouseout=\"this.style.background='rgba(120, 46, 156,");
        return item;
    }

    _getStrikeButtonsForPopup(strike) {
        let html = super._getStrikeButtonsForPopup(strike);
        html = html.replaceAll('background: rgba(50, 50, 50,', 'background: rgba(120, 46, 156,');
        html = html.replaceAll('border: 1px solid #888;', 'border: 1px solid rgba(233, 15, 222, 0.3);');
        return html;
    }

    /**
     * Helper to prepare the action visual (clean name + unique icon)
     */
    _prepareActionDisplay(name, slug, glyph = "", fullId = "") {
        const cleanName = name.replace(/\s*\(P?S?F2E\.Skill\.[^)]+\)/gi, "");
        
        let iconInner = "";
        const hasIcon = SF2E_ICONS[slug];

        if (hasIcon) {
            // Use the centralized icon generator
            iconInner = getIconHtml(slug, { size: '1.3em', extraStyle: 'vertical-align: middle;' });
        } else {
            // Fallback para Material Symbols básico (token) para ações não mapeadas
            const ligature = "token";
            iconInner = `<span class="material-symbols-outlined sf2e-base-icon" style="font-size: 1.3em; transition: opacity 0.15s;">${ligature}</span>`;
        }

        // Use Google Fonts Material Symbols directly via ligature text
        const iconHtml = `
            <div class="sf2e-hud-icon-wrapper" style="position:relative; margin-right: 12px; width:22px; height:20px; display:inline-flex; align-items:center; justify-content:center;">
                ${iconInner}
                <i class="fa-solid fa-comment-alt sf2e-chat-icon" onclick="event.stopPropagation(); StylishAction.useItem('${fullId}:chat', event)" style="position:absolute; opacity:0; transition: opacity 0.15s; color: #00d2ff; font-size: 1.1em; cursor:pointer; pointer-events:auto;"></i>
            </div>`;

        // List of action slugs that require a check (Skills, Exploration, Downtime)
        const rollableSlugs = [
            'balance', 'tumble-through', 'maneuver-in-flight', 'climb', 'high-jump', 'long-jump', 'swim',
            'disable-a-device', 'create-a-diversion', 'demoralize', 'treat-poison', 'command-an-animal',
            'perform', 'hide', 'sneak', 'steal', 'drive', 'stunt', 'run-over',
            'analyze-environment', 'seek', 'sense-motive', 'search', 'borrow-an-arcane-spell', 'decipher-writing',
            'identify-magic', 'learn-a-spell', 'repair', 'impersonate', 'gather-information', 'make-an-impression',
            'coerce', 'treat-wounds', 'navigate', 'plot-course', 'sense-direction', 'track',
            'craft', 'earn-income', 'treat-disease', 'subsist', 'create-forgery',
            'feint', 'aid', 
            'lie', 'request', 'palm-an-object', 'pick-a-lock', 'conceal-an-object', 'squeeze'
        ];
        const rollIndicator = rollableSlugs.includes(slug) ? `<span class="sf2e-roll-indicator" style="margin-left: 10px;"><i class="fas fa-dice-d20"></i> ROLL</span>` : "";

        return {
            hasRaIcon: true,
            html: `<div class="sf2e-action-item-row" style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:10px; white-space: nowrap;">
                    <span style="font-size:1.0em; font-weight:bold; line-height:1.2; text-align:left; display: flex; align-items: center; white-space: nowrap;">${iconHtml}${cleanName}${rollIndicator}</span>
                    <span style="margin-left:auto; display:flex; align-items:center; flex-shrink: 0;">${glyph}</span>
                   </div>`
        };
    }

    // Main attributes in the HUD bar (Party HUD / Player Card)
    getDefaultAttributes() {
        return [
            { path: "system.attributes.hp", label: "HP", color: "#e61c34", style: "bar", icon: "material-symbols-outlined icon-google-hp" }, // Already correct
            { path: "system.attributes.sp", label: "SP", color: "#18d4f3", style: "bar", icon: "material-symbols-outlined icon-google-sp" },
            { path: "system.attributes.ac.value", label: "AC", color: "#ffffff", style: "badge", icon: "material-symbols-outlined icon-google-ac" },
            { path: "system.resources.rp", label: "RP", color: "#f1c40f", style: "badge", icon: "material-symbols-outlined icon-google-rp", badgeScale: 1.0 },
        ];
    }

    // Adds trackable attributes specific to SF2e
    getTrackableAttributes(actor) {
        const stats = super.getTrackableAttributes(actor);
        const s = actor.system;
        // SF2e specific trackable attributes can be added here if needed
        // For now, it just returns the base PF2e trackable attributes.
        return stats;
    }

    /* ------------------------------------------------
       4. INVENTORY (Consumables & Gear)
       ------------------------------------------------ */
    _getInventoryData(actor) {
        const categories = {
            weapon: {
                label: `<span style="display: inline-flex !important; align-items: center !important; white-space: nowrap !important; width: max-content !important;">${this._getLocalizedOrDefault("IBHUD.Pf2e.InvWeapons", "Weapons")} ${getIconHtml('submenu-weapons', { margin: '0 0 0 12px', extraStyle: 'flex-shrink: 0;' })}</span>`, // Increased margin for better spacing
                tooltip: this._getLocalizedOrDefault("IBHUD.Pf2e.InvWeapons", "Weapons"),
            },
            armor: {
                label: `<span style="display: inline-flex !important; align-items: center !important; white-space: nowrap !important; width: max-content !important;">${this._getLocalizedOrDefault("IBHUD.Pf2e.InvArmor", "Armor")} ${getIconHtml('submenu-armor', { margin: '0 0 0 12px', extraStyle: 'flex-shrink: 0;' })}</span>`, // Increased margin for better spacing
                tooltip: this._getLocalizedOrDefault("IBHUD.Pf2e.InvArmor", "Armor"),
            },
            shield: {
                label: `<span style="display: inline-flex !important; align-items: center !important; white-space: nowrap !important; width: max-content !important;">Shields ${getIconHtml('submenu-shields', { margin: '0 0 0 12px', extraStyle: 'flex-shrink: 0;' })}</span>`, // Increased margin for better spacing
                tooltip: "Shields",
            },
            augmentation: {
                label: `<span style="display: inline-flex !important; align-items: center !important; white-space: nowrap !important; width: max-content !important;">Augmentations ${getIconHtml('submenu-augmentations', { margin: '0 0 0 12px', extraStyle: 'flex-shrink: 0;' })}</span>`, // Increased margin for better spacing
                tooltip: "Augmentations (Cybernetics & Biotech)",
            },
            upgrade: {
                label: `<span style="display: inline-flex !important; align-items: center !important; white-space: nowrap !important; width: max-content !important;">Upgrades ${getIconHtml('submenu-upgrades', { margin: '0 0 0 12px', extraStyle: 'flex-shrink: 0;' })}</span>`, // Increased margin for better spacing
                tooltip: "Upgrades / Fusions",
            },
            consumable: {
                label: `<span style="display: inline-flex !important; align-items: center !important; white-space: nowrap !important; width: max-content !important;">${this._getLocalizedOrDefault("IBHUD.Pf2e.InvConsumables", "Consumables")} ${getIconHtml('submenu-consumables', { margin: '0 0 0 12px', extraStyle: 'flex-shrink: 0;' })}</span>`, // Increased margin for better spacing
                tooltip: this._getLocalizedOrDefault("IBHUD.Pf2e.InvConsumables", "Consumables"),
            },
            equipment: {
                label: `<span style="display: inline-flex !important; align-items: center !important; white-space: nowrap !important; width: max-content !important;">${this._getLocalizedOrDefault("IBHUD.Pf2e.InvEquipment", "Equipment")} ${getIconHtml('submenu-equipment', { margin: '0 0 0 12px', extraStyle: 'flex-shrink: 0;' })}</span>`, // Increased margin for better spacing
                tooltip: this._getLocalizedOrDefault("IBHUD.Pf2e.InvEquipment", "Equipment"),
            },
            treasure: {
                label: `<span style="display: inline-flex !important; align-items: center !important; white-space: nowrap !important; width: max-content !important;">${this._getLocalizedOrDefault("IBHUD.Pf2e.InvTreasure", "Treasure")} ${getIconHtml('submenu-treasure', { margin: '0 0 0 12px', extraStyle: 'flex-shrink: 0;' })}</span>`, // Increased margin for better spacing
                tooltip: this._getLocalizedOrDefault("IBHUD.Pf2e.InvTreasure", "Treasure"),
            },
            backpack: {
                label: `<span style="display: inline-flex !important; align-items: center !important; white-space: nowrap !important; width: max-content !important;">${this._getLocalizedOrDefault("IBHUD.Pf2e.InvContainers", "Containers")} ${getIconHtml('menu-inventory', { margin: '0 0 0 12px', extraStyle: 'flex-shrink: 0;' })}</span>`, // Increased margin for better spacing
                tooltip: this._getLocalizedOrDefault("IBHUD.Pf2e.InvContainers", "Containers"),
            },
            ammo: {
                label: `<span style="display: inline-flex !important; align-items: center !important; white-space: nowrap !important; width: max-content !important;">Ammo ${getIconHtml('submenu-ammunition', { margin: '0 0 0 12px', extraStyle: 'flex-shrink: 0;' })}</span>`, // Increased margin for better spacing
                tooltip: "Ammunition",
            },
        };

        const items = {};
        const primaryLabels = {};
        const primaryTooltips = {};
        const subLabels = {};

        Object.keys(categories).forEach((key) => {
            items[key] = { all: [] };
            primaryLabels[key] = categories[key].label;
            primaryTooltips[key] = categories[key].tooltip;
            subLabels[key] = { all: `<span style="display: inline-flex; align-items: center; white-space: nowrap;">All Items</span>` };
        });

        // Added support for 'augmentation' and 'upgrade'
        const physicalItems = actor.items.filter((i) =>
            [
                "weapon",
                "armor",
                "shield",
                "consumable",
                "equipment",
                "treasure",
                "backpack",
                "ammo",
                "augmentation",
                "upgrade"
            ].includes(i.type),
        );

        physicalItems.forEach((i) => {
            const type = i.type;
            if ((type === "consumable" || type === "treasure") && i.quantity <= 0)
                return;

            const actionButtons = this._getInventoryActionButtons(i);
            const quantityHtml = `<span style="font-family:'Teko'; font-size:1.1em; color:var(--g-accent);">x${i.quantity}</span>`;

            const listItem = {
                id: i.id,
                name: `<span style="white-space:normal; overflow:visible; text-overflow:unset; word-break:break-word; line-height:1.3;">${i.name}</span>`, // Overrides base module inline styles to allow name wrapping
                img: i.img || "icons/svg/item-bag.svg",
                hasInlineControls: Boolean(actionButtons),
                cost: actionButtons
                    ? `
                        <div style="display:flex; align-items:flex-start; gap:6px; flex-wrap:wrap; justify-content:flex-end; max-width:180px; row-gap:5px;">
                            ${quantityHtml}
                            ${actionButtons}
                        </div>
                    `
                    : quantityHtml,
                description: i.system.description?.value || "",
            };

            if (items[type]) {
                items[type]["all"].push(listItem);
            }
        });

        Object.keys(items).forEach((key) => {
            if (items[key]["all"].length === 0) {
                delete items[key];
                delete primaryLabels[key];
                delete primaryTooltips[key];
                delete subLabels[key];
            } else {
                items[key]["all"].sort((a, b) => a.name.localeCompare(b.name));
            }
        });

        return {
            title: "INVENTORY",
            theme: "red",
            hasTabs: true,
            hasSubTabs: true,
            items: items,
            tabLabels: primaryLabels,
            tabTooltips: primaryTooltips,
            subTabLabels: subLabels,
        };
    }

    _getInventoryActionButtons(item) {
        const equipped = item.system?.equipped || {};
        const carryType = String(equipped.carryType || "stowed");
        const handsHeld = Number(equipped.handsHeld ?? 0);
        const inSlot = Boolean(equipped.inSlot);
        const invested = Boolean(equipped.invested);
        const usageValue = String(item.system?.usage?.value ?? item.system?.usage ?? "").toLowerCase();
        const canGrip = ["weapon", "shield", "equipment", "consumable", "augmentation"].includes(item.type);
        const canWear = ["weapon", "armor", "shield", "equipment", "consumable", "treasure", "backpack", "augmentation", "upgrade"].includes(item.type) || usageValue.includes("worn");
        const canInvest =
            Array.isArray(item.system?.traits?.value) &&
            item.system.traits.value.includes("invested");
        const isArmorWorn = item.type === "armor" && carryType === "worn" && inSlot;
        const isHeld1 = carryType === "held" && handsHeld <= 1;
        const isHeld2 = carryType === "held" && handsHeld >= 2;
        const isWorn = carryType === "worn" && !isArmorWorn;
        const isStowed = carryType === "stowed";
        const isDropped = carryType === "dropped";

        const options = [];
        const isHeld = carryType === "held";
        const localize = (key, fallback) => {
            const text = game.i18n.localize(key);
            return text && text !== key ? text : fallback;
        };

        const verb = isHeld ? localize("IBHUD.Pf2e.ActionGrip", "Grip") : localize("IBHUD.Pf2e.ActionDraw", "Draw");
        const handsLabel1 = localize("IBHUD.Pf2e.ActionGrip1", "1H");
        const handsLabel2 = localize("IBHUD.Pf2e.ActionGrip2", "2H");

        const addOption = (id, label, iconHtml, active = false) => {
            options.push({ id, label, iconHtml, active });
        };

        if (canGrip) {
            addOption("grip1", `${verb} ${handsLabel1}`, this._getInventoryCarryIconHtml("held", 1), isHeld1);
            addOption("grip2", `${verb} ${handsLabel2}`, this._getInventoryCarryIconHtml("held", 2), isHeld2);
        }
        if (item.type === "armor") {
            addOption("wearArmor", game.i18n.localize("IBHUD.Pf2e.ActionWearArmor"), this._getInventoryCarryIconHtml("worn-armor", 0), isArmorWorn);
        }
        if (canWear) {
            addOption("wear", game.i18n.localize("IBHUD.Pf2e.ActionWear"), this._getInventoryCarryIconHtml("worn", 0), isWorn);
        }
        addOption("stow", game.i18n.localize("IBHUD.Pf2e.ActionStow"), this._getInventoryCarryIconHtml("stowed", 0), isStowed);
        addOption("dropped", game.i18n.localize("IBHUD.Pf2e.ActionDrop"), this._getInventoryCarryIconHtml("dropped", 0), isDropped);

        if (canInvest) {
            options.push({
                id: "invest",
                label: `${game.i18n.localize("IBHUD.Pf2e.ActionInvest")}${invested ? " \u2713" : ""}`,
                iconHtml: `<i class="fas fa-gem"></i>`,
                active: invested,
            });
        }

        // "Use" option for consumables (PF2e Standard Label)
        if (item.type === "consumable") {
            addOption(
                "useConsumable",
                game.i18n.localize("PF2E.Action.Use") || "Use",
                `<i class="fas fa-hand-holding-medical"></i>`,
                false,
            );
        }

        const carryStateLabel = carryType === "held"
            ? `${localize("IBHUD.Pf2e.ActionHeld", "Held")} ${handsHeld >= 2 ? handsLabel2 : handsLabel1}`
            : carryType === "worn"
                ? (isArmorWorn ? localize("IBHUD.Pf2e.ActionWearArmor", "Wear Armor") : localize("IBHUD.Pf2e.ActionWear", "Wear"))
                : carryType === "dropped" ? localize("IBHUD.Pf2e.ActionDrop", "Drop") : localize("IBHUD.Pf2e.ActionStow", "Stow");

        const manageButton = this._buildInventoryManageButton(item.id, carryType, handsHeld, carryStateLabel, options);

        // Quantity +/- buttons for any item with a quantity field
        const hasQuantity = item.quantity !== undefined && 
            ["consumable", "equipment", "treasure", "backpack", "ammo", "augmentation", "upgrade", "weapon", "armor", "shield"].includes(item.type);

        if (!hasQuantity) return manageButton;

        const qtyButtons = `
            <div style="display:inline-flex; align-items:center; gap:2px; margin-left:4px;">
                <button type="button"
                    onclick="event.stopPropagation(); StylishAction.useItem('qty:${item.id}:minus', event)"
                    title="Remove 1"
                    style="background:rgba(50,50,50,0.8); border:1px solid #666; color:#eee; border-radius:3px; padding:1px 5px; font-size:0.8em; cursor:pointer; line-height:1.2;"
                    onmouseover="this.style.background='#eee'; this.style.color='#000';"
                    onmouseout="this.style.background='rgba(50,50,50,0.8)'; this.style.color='#eee';">
                    −
                </button>
                <button type="button"
                    onclick="event.stopPropagation(); StylishAction.useItem('qty:${item.id}:plus', event)"
                    title="Add 1"
                    style="background:rgba(50,50,50,0.8); border:1px solid #666; color:#eee; border-radius:3px; padding:1px 5px; font-size:0.8em; cursor:pointer; line-height:1.2;"
                    onmouseover="this.style.background='#eee'; this.style.color='#000';"
                    onmouseout="this.style.background='rgba(50,50,50,0.8)'; this.style.color='#eee';">
                    +
                </button>
            </div>`;

        return manageButton + qtyButtons;
    }

    /**
     * Injects utilities while maintaining native Saves, Toggles, and Macros.
     * The Stylish HUD separates this into tabs: Saves, Skills, Toggles, Other.
     Icons Submenu - CHECKS*/
    _getUtilityData(actor) {
        // Obtains base data (Saves, Skills, Toggles, Other, Macro)
        const data = super._getUtilityData(actor);
        
        // Move Initiative from 'Other' (Rest) to 'Skill' (Checks) tab
        if (data.items.other?.all) {
            const initIdx = data.items.other.all.findIndex(i => i.id === "check-initiative");
            if (initIdx !== -1) {
                const initItem = data.items.other.all.splice(initIdx, 1)[0];
                if (data.items.skill?.all) data.items.skill.all.unshift(initItem);
            }
        }

        const assetPath = "modules/stylish-bridge-sf2e/assets/actions"; // Unused variable, can be removed

        // Helpers para ícones locais (SVG) e Google Material Symbols
        const getIcon = (svg) => `<span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/${svg}.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/${svg}.svg'); margin-left: 8px; width: 1.1em; height: 1.1em; display: inline-block;"></span>`;

        if (!data.tabLabels) data.tabLabels = {};
        if (!data.tabTooltips) data.tabTooltips = {};
        
        Object.assign(data.tabLabels, {
            save: `<span style="display: inline-flex; align-items: center; white-space: nowrap;">Saving Throws ${getIconHtml('submenu-saves', { margin: '0 0 0 12px' })}</span>`, // Increased margin for better spacing
            skill: `<span style="display: inline-flex; align-items: center; white-space: nowrap;">Skills ${getIconHtml('submenu-skills', { margin: '0 0 0 12px' })}</span>`,
            toggle: `<span style="display: inline-flex; align-items: center; white-space: nowrap;">Triggers ${getIconHtml('submenu-triggers', { margin: '0 0 0 12px' })}</span>`,
            dying: `<span style="display: inline-flex; align-items: center; white-space: nowrap;">Recovery ${getIconHtml('submenu-recovery', { margin: '0 0 0 12px' })}</span>`,
            other: `<span style="display: inline-flex; align-items: center; white-space: nowrap;">Rest ${getIconHtml('submenu-rest', { margin: '0 0 0 12px' })}</span>`,
            macro: `<span style="display: inline-flex; align-items: center; white-space: nowrap;">Custom Macros ${getIconHtml('submenu-macro', { margin: '0 0 0 12px' })}</span>`
        });

        Object.assign(data.tabTooltips, {
            save: "Saving Throws",
            skill: "Skills",
            toggle: "Triggers",
            dying: "Recovery",
            other: "Rest",
            macro: "Custom Macros"
        });

        // 1. Death / Recovery Tab Processing
        if (!data.items.dying) data.items.dying = { all: [] };
        
        const dying = actor.itemTypes.condition.find(c => c.slug === "dying");
        const wounded = actor.itemTypes.condition.find(c => c.slug === "wounded");
        const dyingVal = dying?.value ?? 0; // Current dying value
        const woundedVal = wounded?.value ?? 0;
        const deathLimit = actor.attributes.hp?.deathLimit ?? 4;

        data.items.dying.all.push({
            id: "sf2e-util:recovery-check",
            name: "Recovery Check",
            img: "icons/magic/death/hand-withered-gray.webp",
            cost: "",
            description: "Roll a Recovery Flat Check (DC 10 + Dying value)."
        });

        // Dying Pips track - Becomes a skull when reaching the limit
        const isDead = dyingVal >= deathLimit;
        let dyingCostHtml = `<div style="display:flex; gap:4px; align-items:center; cursor:pointer;" 
            onclick="event.stopPropagation(); StylishAction.useItem('sf2e-condition:dying:increase', event)"
            oncontextmenu="event.stopPropagation(); event.preventDefault(); StylishAction.useItem('sf2e-condition:dying:reduce', event)">`;
        
        if (isDead) {
            dyingCostHtml += getIconHtml('submenu-dying', { size: '20px', color: '#ff3333', extraStyle: 'filter: drop-shadow(0 0 2px #000);' });
        } else {
            const pipColor = dyingVal === 1 ? "#00ff00" : (dyingVal > 1 ? "#ff9900" : "#ff3333");
            for (let i = 1; i <= deathLimit; i++) {
                const active = i <= dyingVal;
                const color = active ? pipColor : "rgba(255,255,255,0.1)";
                dyingCostHtml += `<span style="width:12px; height:12px; border-radius:50%; border:1px solid ${active ? color : '#555'}; background:${color}; box-shadow: ${active ? 'inset 0 0 3px #000, 0 0 4px ' + color : 'inset 0 0 2px #000'};"></span>`;
            }
        }
        dyingCostHtml += `</div>`;

        data.items.dying.all.push({
            id: "sf2e-condition:dying",
            name: isDead ? "R.I.P" : "Dying",
            img: isDead ? "icons/magic/death/undead-skeleton-lich-armor.webp" : "systems/pf2e/icons/conditions/dying.webp",
            cost: dyingCostHtml,
            description: "Dying level (Left-click to increase, Right-click to decrease)."
        });

        // Wounded Pips track
        let woundedCostHtml = `<div style="display:flex; gap:4px; align-items:center; cursor:pointer;" 
            onclick="event.stopPropagation(); StylishAction.useItem('sf2e-condition:wounded:increase', event)"
            oncontextmenu="event.stopPropagation(); event.preventDefault(); StylishAction.useItem('sf2e-condition:wounded:reduce', event)">`;
        
        for (let i = 1; i <= 3; i++) {
            const active = i <= woundedVal;
            const color = active ? "#ff9900" : "rgba(255,255,255,0.1)";
            woundedCostHtml += `<span style="width:12px; height:12px; border-radius:50%; border:1px solid ${active ? '#ffcc00' : '#555'}; background:${color}; box-shadow: ${active ? 'inset 0 0 3px #000, 0 0 4px #ff9900' : 'inset 0 0 2px #000'};"></span>`;
        }
        woundedCostHtml += `</div>`;

        data.items.dying.all.push({
            id: "sf2e-condition:wounded",
            name: "Wounded",
            img: "systems/pf2e/icons/conditions/wounded.webp",
            cost: woundedCostHtml,
            description: "Wounded level (Left-click to increase, Right-click to decrease)."
        });

        // 1. Skill & Lore Processing
        if (data.items?.skill) {
            if (data.items.skill.all) {
                // Filter out Lores from the main "All" list to avoid duplication
                const loreSlugs = actor.itemTypes.lore.map(l => l.slug || l.name.slugify());
                data.items.skill.all = data.items.skill.all.filter(item => {
                    const slug = item.id.replace("skill-", "");
                    return !loreSlugs.includes(slug);
                });

                data.items.skill.all.forEach(item => { // Iterate over all skill items
                    // Cleans standard skill names
                    if (item.name) item.name = item.name.replace(/\s*\(P?S?F2E\.Skill\.[^)]+\)/gi, "");
                    // Use system icon or a safe Core Foundry fallback
                    item.img = item.img || "icons/svg/d20.svg";
                });
            }
            
            // Creates the separate sub-tab for Lore
            data.items.skill.lore = [];
            actor.itemTypes.lore.forEach(lore => {
                const slug = lore.slug || lore.name.slugify();
                const skill = actor.skills[slug];
                const mod = skill?.mod ?? skill?.totalModifier ?? skill?.value ?? 0;
                const rank = skill?.rank ?? lore.system.proficient?.value ?? 0;
                const rankLetter = ["U", "T", "E", "M", "L"][rank] || "U"; // Use U for Untrained (rank 0)
                const rankLabel = game.i18n.localize(`PF2E.ProficiencyLevel${rank}`); // Localize label based on rank

                let circleColor = "";
                switch (rank) {
                    case 0: circleColor = "#6b7280"; break; // Untrained (cinza)
                    case 1: circleColor = "#2c4e69"; break; // Trained (azul)
                    case 2: circleColor = "#5b3a96"; break; // Expert (roxo)
                    case 3: circleColor = "#3a7b59"; break; // Master (verde)
                    case 4: circleColor = "#98503d"; break; // Legendary (laranja)
                    default: circleColor = "#6b7280"; // Default to untrained
                }

                const circleHtml = `
                    <span style="
                        display: inline-block;
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background-color: ${circleColor};
                        margin-right: 4px;
                        vertical-align: middle;
                        box-shadow: 0 0 3px ${circleColor};
                    "></span>`;

                const rankHtml = `
                    <span title="${rankLabel}" style="
                        margin-right: 4px;
                        font-size: 0.8em;
                        opacity: 0.9;
                        background: rgba(255,255,255,0.08);
                        border: 1px solid rgba(255,255,255,0.15);
                        border-radius: 3px;
                        padding: 1px 4px;
                        display: inline-flex; /* Use flex to align circle and text */
                        align-items: center;
                        justify-content: center;
                    ">${circleHtml}${rankLetter}</span>`;

                data.items.skill.lore.push({
                    id: `skill-${lore.slug || lore.id}`,
                    name: lore.name,
                    img: lore.img || "icons/svg/d20.svg",
                    cost: `<span style="color: var(--sf2e-checks-color, #c084fc); font-weight: bold; display: flex; align-items: center;">${rankHtml}${mod >= 0 ? "+" : ""}${mod}</span>`,
                    description: `<div style="margin-bottom:5px;padding:2px 6px;background:rgba(167,139,250,0.1);border-left:3px solid var(--sf2e-checks-color, #c084fc);border-radius:2px;"><strong style="color: var(--sf2e-checks-color, #c084fc);">Modifier: ${mod >= 0 ? "+" : ""}${mod}</strong></div>${game.i18n.format("PF2E.SkillCheckWithName", { skillName: lore.name })}`
                });
            });

            // Defines sub-tab labels for visual separation / icon for skills and lore tabs
            if (!data.subTabLabels.skill) {
                data.subTabLabels.skill = {};
            }
            data.subTabLabels.skill = { // Updated to use material-symbols-outlined
                all: `${game.i18n.localize("PF2E.SkillsLabel") || "Skills"} ${getIconHtml('submenu-skills-basic', { margin: '0 0 0 10px' })}`,
                lore: `Lore Skills ${getIconHtml('submenu-lore-skills', { margin: '0 0 0 10px' })}`
            };

            data.items.skill.lore.sort((a, b) => a.name.localeCompare(b.name));
        }

        return data;
    }

    /**
     * Overrides utility sidebar labels to match the new Starfinder 2e naming and local icons.
     */
    _prepareUtilitySubTabLabels() {
        return {
            save: { all: `Saving Throws ${getIconHtml('submenu-saves', { margin: '0 0 0 12px' })}` }, // Spacing for utility sub-tabs
            skill: { all: `Skills ${getIconHtml('submenu-skills', { margin: '0 0 0 12px' })}` },
            toggle: { all: `Triggers ${getIconHtml('submenu-triggers', { margin: '0 0 0 12px' })}` },
            dying: { all: `Recovery ${getIconHtml('submenu-recovery', { margin: '0 0 0 12px' })}` },
            other: { all: `Rest ${getIconHtml('submenu-rest', { margin: '0 0 0 12px' })}` },
            macro: { all: `Custom Macros ${getIconHtml('submenu-macro', { margin: '0 0 0 12px' })}` },
        };
    }

    /**
     * Corrects action names and injects custom icons from the assets/actions folder
     */
    async _getActionData(actor) {
        // Encounter Slugs
        const slugsAttack = ['escape', 'disarm', 'grapple', 'shove', 'trip', 'reposition', 'feint', 'area-fire', 'auto-fire'];
        const slugsMovement = ['stride', 'step', 'stand', 'crawl', 'leap'];
        const slugsInteractPercept = ['interact', 'seek', 'sense-motive', 'point-out'];
        const slugsDefenseSupport = ['take-cover', 'raise-a-shield', 'avert-gaze', 'ready'];
        const slugsSpecialty = ['burrow', 'fly', 'mount', 'push-off', 'dismiss', 'sustain'];
        const slugsSkillCombat = [
            'balance', 'tumble-through', 'maneuver-in-flight', 'climb', 'force-open', 'high-jump', 'long-jump', 'swim',
            'recall-knowledge', 'disable-a-device', 'create-a-diversion', 'demoralize',
            'treat-poison', 'command-an-animal', 'perform', 'hide', 'sneak', 'steal', 'administer-first-aid', // Moved back to skill combat
            'drive', 'stop', 'stunt', 'take-control', 'run-over'
        ];
        const slugsReactions = ['aid', 'arrest-a-fall', 'grab-an-edge'];
        const slugsFreeActions = ['delay', 'release'];

        // Exploration Slugs
        const slugsExploration = [
            'analyze-environment', 'avoid-notice', 'defend', 'detect-magic', 'scout', 'search',
            'hustle', 'follow-the-expert', 'sustain-an-effect', 'repeat-a-spell',
            'livestream', 'recharge', 'access-infosphere', 'operate-device', 'hack',
            'squeeze', 'borrow-an-arcane-spell', 'decipher-writing', 'identify-magic', 'learn-a-spell', 'repair', // Removed 'administer-first-aid' from exploration
            'impersonate', 'gather-information', 'make-an-impression', 'coerce', 'treat-wounds', // 'treat-wounds' is already here
            'navigate', 'plot-course', 'sense-direction', 'cover-tracks', 'track'
        ];

        // Downtime Slugs
        const slugsDowntime = ['craft', 'earn-income', 'treat-disease', 'subsist', 'create-forgery'];

        const seenSlugs = new Set();

        // Temporary buckets for organization before flattening
          const buckets = { // Buckets for organizing actions by category
            encounter: {
                  attack: [], // Offensive actions
                movement: [],
                interact_percept: [],
                defense_support: [],
                specialty: [],
                skill_combat: [],
                reactions: [],
                free: []
            },
              exploration: [], // Exploration activities
              downtime: [] // Downtime activities
        };

          // Manually inject Treat Wounds at the beginning to ensure priority and correct icon
        if (!seenSlugs.has('treat-wounds')) {
              // Fetch the action directly from the system to get official description and traits
            const systemAction = (game.pf2e.actions instanceof Map) 
                ? game.pf2e.actions.get('treat-wounds') 
                : game.pf2e.actions.find?.(a => a.slug === 'treat-wounds');
            
            const twName = systemAction?.name ? this._getLocalizedOrDefault(systemAction.name, "Treat Wounds") :
                           this._getLocalizedOrDefault("PF2E.Actions.TreatWounds.Label", this._getLocalizedOrDefault("PF2E.Action.TreatWounds", "Treat Wounds"));

            const display = this._prepareActionDisplay(twName, 'treat-wounds', "", `skillaction:treat-wounds`);
            const twIcon = "modules/stylish-bridge-sf2e/assets/icons/actions-symbols/treat-wounds.svg";
            
            // Tenta localizar a descrição do sistema SF2e/PF2e. 
            // If it returns the technical key (PF2E.Action...), use the official SF2e fallback.
            const localizedDesc = systemAction?.description ? game.i18n.localize(systemAction.description).trim() : "";
            const twDesc = (!localizedDesc || localizedDesc.includes("PF2E.")) 
                ? Starfinder2eAdapter.TREAT_WOUNDS_DESCRIPTION_HTML 
                : localizedDesc;

            const twTraits = systemAction?.traits ? (systemAction.traits instanceof Set ? Array.from(systemAction.traits) : systemAction.traits) : ["medicine", "exploration", "healing", "manipulate"];

            buckets.exploration.push({
                id: `skillaction:treat-wounds`,
                name: display.html,
                img: "", // Leave empty so only the icon injected in the HTML (name) appears
                cost: "",
                description: await this._prepareTooltip(twName, twDesc, twTraits),
                tooltipData: {
                    traits: twTraits,
                    description: twDesc
                }
            });
            seenSlugs.add('treat-wounds');
        }

        // 1. System Actions
        if (game.pf2e?.actions) {
            const actionEntries = (game.pf2e.actions instanceof Map) ? Array.from(game.pf2e.actions.values()) : Array.from(game.pf2e.actions);
            for (const action of actionEntries) {
                try {
                if (!action || !action.slug) continue;
                if (seenSlugs.has(action.slug)) continue;
                seenSlugs.add(action.slug);

                let name = action.name ? this._getLocalizedOrDefault(action.name, action.slug.replace(/-/g, ' ').capitalize()) : action.slug;
                const traits = action.traits instanceof Set ? Array.from(action.traits) : (action.traits || []);
                const glyph = this._getActionGlyph(action.cost || action.actionType);
                const display = this._prepareActionDisplay(name, action.slug, glyph, `skillaction:${action.slug}`);
                let img = (action.img && !display.hasRaIcon && !action.img.includes("mystery-man")) ? action.img : "";
                if (!img && !display.hasRaIcon) img = "icons/svg/d20.svg";

                const variants = (['trip', 'grapple', 'reposition', 'disarm', 'shove', 'escape', 'force-open', 'administer-first-aid', 'recall-knowledge'].includes(action.slug))
                    ? (action.slug === 'administer-first-aid' ? ['STABILIZE <i class="fas fa-dice-d20 sf2e-spin-icon" style="margin-left:4px; color:#00ff00;"></i> ROLL', 'STOP BLEEDING <i class="fas fa-dice-d20 sf2e-spin-icon" style="margin-left:4px; color:#00ff00;"></i> ROLL'] : 
                       action.slug === 'recall-knowledge' ? ['KNOWLEDGE CHECK <i class="fas fa-dice-d20 sf2e-spin-icon" style="margin-left:4px; color:#00ff00;"></i> ROLL'] :
                       ['NORMAL', 'MAP -5', 'MAP -10'])
                    : [];

                let finalName = display.html;
                if (variants.length > 0) {
                    let buttonsHtml = `<div style="display:flex; gap:3px; flex-wrap:wrap; margin-top:4px;">`;
                    variants.forEach((v, idx) => {
                        const opacity = idx === 0 ? "1.0" : idx === 1 ? "0.8" : "0.6";
                        buttonsHtml += `
                            <button type="button" 
                                onclick="event.stopPropagation(); StylishAction.useItem('skillaction:${action.slug}:${idx}', event)"
                                style="background:rgba(120, 46, 156, ${opacity}); border:1px solid rgba(233, 15, 222, 0.3); color:#fff; border-radius:3px; padding:1px 6px; font-size:0.85em; font-family:'Oswald',sans-serif; cursor:pointer; line-height:1.2; min-width:30px; text-align:center;"
                                onmouseover="this.style.background='rgba(255,255,255,0.2)'; this.style.color='#fff';"
                                onmouseout="this.style.background='rgba(120, 46, 156, ${opacity})'; this.style.color='#fff';"
                            >${v}</button>`;
                    });
                    buttonsHtml += `</div>`;

                    finalName = `
                        <div style="display:flex; flex-direction:column; align-items:flex-start; width:100%;">
                            ${display.html}
                            ${buttonsHtml}
                        </div>`;
                }

                const itemData = {
                    id: `skillaction:${action.slug}`,
                    name: finalName,
                    img: img,
                    cost: "",
                    description: await this._prepareTooltip(name, (() => {
                        if (!action.description) return "";
                        const loc = game.i18n.localize(action.description);
                        return (loc === action.description) ? "" : loc;
                    })(), traits),
                    tooltipData: {
                        traits: traits,
                        description: action.description
                    }
                };

                if (slugsAttack.includes(action.slug)) buckets.encounter.attack.push(itemData);
                else if (slugsMovement.includes(action.slug)) buckets.encounter.movement.push(itemData);
                else if (slugsInteractPercept.includes(action.slug)) buckets.encounter.interact_percept.push(itemData);
                else if (slugsDefenseSupport.includes(action.slug)) buckets.encounter.defense_support.push(itemData);
                else if (slugsSpecialty.includes(action.slug)) buckets.encounter.specialty.push(itemData);
                else if (slugsSkillCombat.includes(action.slug)) buckets.encounter.skill_combat.push(itemData);
                else if (slugsReactions.includes(action.slug)) buckets.encounter.reactions.push(itemData);
                else if (slugsFreeActions.includes(action.slug)) buckets.encounter.free.push(itemData);
                else if (slugsExploration.includes(action.slug)) buckets.exploration.push(itemData);
                else if (slugsDowntime.includes(action.slug)) buckets.downtime.push(itemData);
                else {
                    // Fallback to avoid losing unknown actions
                    if (action.actionType === "reaction" || action.actionType === "free") {
                        buckets.encounter.reactions.push(itemData);
                    } else {
                        buckets.encounter.skill_combat.push(itemData);
                    }
                }
                } catch (e) { console.error("SF2E Bridge | Action Build Error:", e); }
            }
        }

        // 2. Actor Actions (Feats/Items)
        const actorItems = actor.itemTypes.action;
        for (const i of actorItems) {
            const actionType = i.system.actionType?.value || "action";
            const glyph = this._getActionGlyph(i.system.actions?.value || i.actionCost || actionType);
            const slug = i.slug || i.name.slugify();
            if (seenSlugs.has(slug)) continue;
            seenSlugs.add(slug);

            const display = this._prepareActionDisplay(i.name, slug, glyph, i.id);
            const traits = i.system.traits?.value || [];

            let img = (i.img && !display.hasRaIcon && !i.img.includes("mystery-man")) ? i.img : "";
            if (!img && !display.hasRaIcon) img = "icons/svg/d20.svg";

            const chatData = await i.getChatData();

            const itemData = {
                id: i.id,
                name: display.html,
                img: img,
                cost: "",
                description: await this._prepareTooltip(i.name, chatData.description.value, chatData.traits, chatData.rarity),
                tooltipData: {
                    traits: traits,
                    rarity: i.system.traits?.rarity,
                    description: i.system.description.value
                }
            };

            if (slugsAttack.includes(slug)) buckets.encounter.attack.push(itemData);
            else if (slugsMovement.includes(slug)) buckets.encounter.movement.push(itemData);
            else if (slugsInteractPercept.includes(slug)) buckets.encounter.interact_percept.push(itemData);
            else if (slugsDefenseSupport.includes(slug)) buckets.encounter.defense_support.push(itemData);
            else if (slugsSpecialty.includes(slug)) buckets.encounter.specialty.push(itemData);
            else if (slugsExploration.includes(slug)) buckets.exploration.push(itemData);
            else if (slugsDowntime.includes(slug)) buckets.downtime.push(itemData);
            else if (actionType === "reaction" || slugsReactions.includes(slug)) buckets.encounter.reactions.push(itemData);
            else if (actionType === "free" || slugsFreeActions.includes(slug)) buckets.encounter.free.push(itemData);
            else if (actionType === "passive") { /* ignore */ }
            else buckets.encounter.skill_combat.push(itemData);
        }
        
        // === ETAPA 8: INTEGRAÇÃO COM ACTIONS CONDICIONAIS ===
        const conditionalResults = await this._getConditionalActionsData(actor, seenSlugs);

        // Mesclagem nos buckets de Encounter
        for (const [key, items] of Object.entries(conditionalResults.encounter)) {
            if (Array.isArray(items) && buckets.encounter[key]) {
                buckets.encounter[key].push(...items);
            }
        }

        // Mesclagem em Exploration e Downtime
        buckets.exploration.push(...conditionalResults.exploration);
        buckets.downtime.push(...conditionalResults.downtime);

        // Flatten Buckets into items array with Headers (The "Submenus")
        const items = { encounter: [], exploration: [], downtime: [] };

        // Flatten Encounter
        const encounterLabels = {
            attack: "Attacks & Maneuvers",
            movement: "Movement",
            interact_percept: "Interaction & Perception",
            defense_support: "Defense & Support",
            specialty: "Special",
            skill_combat: "Skill Actions",
            reactions: "Reactions",
            free: "Free Actions"
        };

        for (const [key, label] of Object.entries(encounterLabels)) {
            if (buckets.encounter[key]?.length > 0) {
                items.encounter.push({ id: `header-${key}`, isHeader: true, name: label });
                items.encounter.push(...buckets.encounter[key].sort((a, b) => a.name.localeCompare(b.name)));
            }
        }

        // Flatten Exploration & Downtime
        if (buckets.exploration.length > 0) {
            items.exploration.push({ id: "header-exploration", isHeader: true, name: "Exploration Activities" });
            items.exploration.push(...buckets.exploration.sort((a, b) => a.name.localeCompare(b.name)));
        }
        if (buckets.downtime.length > 0) {
            items.downtime.push({ id: "header-downtime", isHeader: true, name: "Downtime Activities" });
            items.downtime.push(...buckets.downtime.sort((a, b) => a.name.localeCompare(b.name)));
        }

        const tabLabels = {
            encounter: `<span style="display: flex; align-items: center; white-space: nowrap;">Encounter ${getIconHtml('tab-encounter', { size: '1.2em', margin: '0 0 0 12px' })}</span>`, // Spacing for action mode tabs
            exploration: `<span style="display: flex; align-items: center; white-space: nowrap;">Exploration ${getIconHtml('tab-exploration', { size: '1.2em', margin: '0 0 0 12px' })}</span>`,
            downtime: `<span style="display: flex; align-items: center; white-space: nowrap;">Downtime ${getIconHtml('tab-downtime', { size: '1.2em', margin: '0 0 0 12px' })}</span>`
        };

        const tabTooltips = {
            encounter: "Encounter actions are used when time is measured in rounds.",
            exploration: "Continuous activities performed while the party travels or investigates.",
            downtime: "Actions performed during periods of rest, lasting days or weeks."
        };

        return { title: "ACTIONS", theme: "blue", hasTabs: true, hasSubTabs: false, items, tabLabels, tabTooltips };
    }

    /**
     * Retorna actions condicionais e específicas de SF2e baseadas no estado do actor.
     * Implementa a Lógica de Filtragem (Etapa 5) e o Mapeamento (Etapa 4/6).
     * 
     * @param {Actor} actor - O ator selecionado.
     * @param {Set} seenSlugs - Conjunto de slugs já processados para evitar duplicatas (Regra 2).
     */
    async _getConditionalActionsData(actor, seenSlugs = new Set()) {
        const results = {
            encounter: { 
                attack: [], movement: [], interact_percept: [],
                defense_support: [], specialty: [], skill_combat: [],
                reactions: [], free: [] 
            },
            exploration: [],
            downtime: []
        };

        // Helpers de verificação de proficiência e capacidades (Lógica de Filtragem - Etapa 5)
        const skillRank = (slug) => actor.skills[slug]?.rank ?? 0;
        const isTrained = (s) => skillRank(s) >= 1;
        const hasSpeed = (type) => actor.system.attributes.speed.otherSpeeds?.some(s => s.type === type);
        const hasShield = actor.itemTypes.shield?.some(s => s.isEquipped) || actor.heldItems?.some(i => i.type === "shield");
        const hasSpellcasting = (actor.spellcasting?.size ?? 0) > 0;

        // Dicionário de Actions SF2e - Mapeamento Completo (Etapa 4, 6 e 7)
        const conditionalActions = [
            // --- SPECIALTY & BASIC ---
            { slug: "push-off", bucket: "encounter.specialty", show: true, name: "Push Off", cost: "1", traits: ["move"], desc: "SF2E.Actions.PushOff.Description",
              descFallback: "You push off a solid object within reach, moving up to your Speed in any direction." },
            { slug: "switch-hands", bucket: "encounter.interact_percept", show: true, name: "Switch Hands", cost: "1", traits: ["manipulate"], desc: "SF2E.Actions.SwitchHands.Description",
              descFallback: "You switch an item from one hand to the other or rearrange how you are holding items." },
            { slug: "area-fire", bucket: "encounter.attack", show: true, name: "Area Fire", cost: "2", traits: ["area", "attack"], desc: "SF2E.Actions.AreaFire.Description",
              descFallback: "You unleash a sustained burst of fire at an area, making an attack against all creatures in the targeted zone." },
            { slug: "auto-fire", bucket: "encounter.attack", show: true, name: "Auto-Fire", cost: "2", traits: ["area", "attack"], desc: "SF2E.Actions.AutoFire.Description",
              descFallback: "You hold the trigger and sweep automatic fire across a cone or line, hitting all creatures in the area." },
            { slug: "raise-a-shield", bucket: "encounter.defense_support", show: hasShield, name: "Raise a Shield", cost: "1", traits: [], desc: "PF2E.Action.RaiseAShield.Description",
              descFallback: "You position your shield to protect yourself. You gain your shield's bonus to AC until the start of your next turn." },
            { slug: "grab-an-edge", bucket: "encounter.reactions", show: true, name: "Grab an Edge", cost: "Reaction", traits: ["manipulate"], desc: "PF2E.Action.GrabAnEdge.Description",
              descFallback: "Trigger: You fall from or past an edge. You grab a nearby edge to slow your fall, attempting an Athletics check to catch yourself." },

            // --- MOVIMENTAÇÃO CONDICIONAL ---
            { slug: "fly", bucket: "encounter.specialty", show: hasSpeed("fly"), name: "Fly", cost: "1", traits: ["move"], desc: "PF2E.Action.Fly.Description",
              descFallback: "You move through the air up to your fly Speed. Moving upward counts as difficult terrain." },
            { slug: "burrow", bucket: "encounter.specialty", show: hasSpeed("burrow"), name: "Burrow", cost: "1", traits: ["move"], desc: "PF2E.Action.Burrow.Description",
              descFallback: "You move through the earth up to your burrow Speed. You cannot burrow through solid rock unless you have a special ability allowing it." },
            { slug: "arrest-a-fall", bucket: "encounter.reactions", show: hasSpeed("fly"), name: "Arrest a Fall", cost: "Reaction", traits: [], desc: "PF2E.Action.ArrestAFall.Description",
              descFallback: "Trigger: You fall while you have a fly Speed. You slow your fall and are treated as if you fell a shorter distance." },
            { slug: "maneuver-in-flight", bucket: "encounter.skill_combat", show: hasSpeed("fly"), name: "Maneuver in Flight", cost: "1", traits: ["move"], desc: "PF2E.Action.ManeuverInFlight.Description",
              descFallback: "You attempt an Acrobatics check to perform a complex maneuver while flying, such as turning sharply or flying through a tight space." },

            // --- COMPUTERS ---
            { slug: "access-infosphere", bucket: "exploration", show: true, name: "Access Infosphere", cost: "Exploration", traits: ["exploration", "concentrate"], desc: "SF2E.Actions.AccessInfosphere.Description",
              descFallback: "You access the infosphere to research information, looking up facts, maps, or data relevant to your current situation." },
            { slug: "hack", bucket: "exploration", show: isTrained("computers"), name: "Hack", cost: "Exploration", traits: ["exploration", "concentrate"], desc: "SF2E.Actions.Hack.Description",
              descFallback: "You use your Computers skill to break into a secured system, bypassing firewalls and security protocols to access restricted data or functions." },
            { slug: "operate-device", bucket: "exploration", show: true, name: "Operate Device", cost: "Exploration", traits: ["exploration", "manipulate"], desc: "SF2E.Actions.OperateDevice.Description",
              descFallback: "You interact with a complex technological device, using your Computers or Engineering skill to activate, configure, or manipulate it." },

            // --- PILOTING ---
            { slug: "drive", bucket: "encounter.skill_combat", show: true, name: "Drive", cost: "1-3", traits: ["concentrate"], desc: "SF2E.Actions.Drive.Description",
              descFallback: "You pilot a vehicle, moving it up to its Speed. Spending more actions increases the distance traveled." },
            { slug: "run-over", bucket: "encounter.attack", show: true, name: "Run Over", cost: "1", traits: ["attack"], desc: "SF2E.Actions.RunOver.Description",
              descFallback: "You drive your vehicle through a creature's space, making an attack roll to deal damage based on the vehicle's bulk and speed." },
            { slug: "stunt", bucket: "encounter.skill_combat", show: isTrained("piloting"), name: "Stunt", cost: "1-2", traits: ["concentrate"], desc: "SF2E.Actions.Stunt.Description",
              descFallback: "You attempt a Piloting check to perform a daring vehicular maneuver such as a sharp turn, a bootleg reverse, or squeezing through a tight gap." },
            { slug: "take-control", bucket: "encounter.skill_combat", show: isTrained("piloting"), name: "Take Control", cost: "2", traits: ["concentrate"], desc: "SF2E.Actions.TakeControl.Description",
              descFallback: "You attempt to seize control of a vehicle being driven by someone else, making an opposed Piloting check to wrest the controls away." },
            { slug: "navigate", bucket: "exploration", show: isTrained("piloting"), name: "Navigate", cost: "Exploration", traits: ["exploration", "concentrate"], desc: "SF2E.Actions.Navigate.Description",
              descFallback: "You plot a course through space or an unfamiliar region, using Piloting to determine the fastest or safest route to your destination." },
            { slug: "plot-course", bucket: "exploration", show: isTrained("piloting"), name: "Plot Course", cost: "Exploration", traits: ["exploration", "concentrate"], desc: "SF2E.Actions.PlotCourse.Description",
              descFallback: "You carefully calculate a starship jump or long-distance travel route, making a Piloting check to reduce travel time or avoid hazards." },
            { slug: "stop", bucket: "encounter.skill_combat", show: true, name: "Stop", cost: "1", traits: ["concentrate"], desc: "SF2E.Actions.Stop.Description",
              descFallback: "You bring a vehicle to a controlled halt, reducing its speed to zero without causing damage to passengers or the vehicle." },

            // --- OUTRAS SKILL ACTIONS ---
            // --- STEALTH & SURVIVAL ---
            { slug: "avoid-notice", bucket: "exploration", show: true, name: "Avoid Notice", cost: "Exploration", traits: ["exploration"], desc: "PF2E.Action.AvoidNotice.Description",
              descFallback: "You attempt to travel without being noticed during exploration. You use Stealth for your initiative if you enter a combat encounter." },
            { slug: "analyze-environment", bucket: "exploration", show: isTrained("survival"), name: "Analyze Environment", cost: "Exploration", traits: ["exploration", "concentrate"], desc: "SF2E.Actions.AnalyzeEnvironment.Description",
              descFallback: "You study your surroundings using Survival to identify hazards, resources, local wildlife behavior, and safe paths through the area." },
            { slug: "cover-tracks", bucket: "exploration", show: isTrained("survival"), name: "Cover Tracks", cost: "Exploration", traits: ["exploration", "concentrate", "move"], desc: "PF2E.Action.CoverTracks.Description",
              descFallback: "You move at half speed while hiding evidence of your passage, making a Survival check so creatures cannot track you." },
            { slug: "track", bucket: "exploration", show: isTrained("survival"), name: "Track", cost: "Exploration", traits: ["exploration", "concentrate", "move"], desc: "PF2E.Action.Track.Description",
              descFallback: "You follow a trail left by a creature, making Survival checks at a DC set by the quarry's attempts to cover its tracks." },
            { slug: "sense-direction", bucket: "exploration", show: true, name: "Sense Direction", cost: "Exploration", traits: ["exploration", "secret"], desc: "PF2E.Action.SenseDirection.Description",
              descFallback: "You use Survival to get your bearings and orient yourself in an unfamiliar environment, determining which direction is north or identifying landmarks." },
            { slug: "defend", bucket: "exploration", show: true, name: "Defend", cost: "Exploration", traits: ["exploration"], desc: "PF2E.Action.Defend.Description",
              descFallback: "You remain vigilant while exploring, raising your shield if you have one. You gain a +2 circumstance bonus to AC during exploration." },

            // --- EXPLORATION BASICS ---
            { slug: "recharge", bucket: "exploration", show: true, name: "Recharge", cost: "Exploration", traits: ["exploration", "manipulate"], desc: "SF2E.Actions.Recharge.Description",
              descFallback: "You take time to recharge a technological item or battery, restoring its charges or power supply through a generator or power cell." },
            { slug: "livestream", bucket: "exploration", show: true, name: "Livestream", cost: "Exploration", traits: ["exploration", "concentrate"], desc: "SF2E.Actions.Livestream.Description",
              descFallback: "You broadcast your surroundings or actions live over the infosphere, potentially gathering an audience and earning Resolve Points or reputation." },
            { slug: "detect-magic", bucket: "exploration", show: hasSpellcasting, name: "Detect Magic", cost: "Exploration", traits: ["exploration", "concentrate"], desc: "PF2E.Action.DetectMagic.Description",
              descFallback: "You cast detect magic repeatedly while exploring, immediately noticing any magic auras that come within 30 feet of you." },
            { slug: "squeeze", bucket: "exploration", show: isTrained("acrobatics"), name: "Squeeze", cost: "Exploration", traits: ["exploration", "move"], desc: "PF2E.Action.Squeeze.Description",
              descFallback: "You contort your body to squeeze through a gap narrower than your space, using Acrobatics to move at half Speed through the tight area." },
            { slug: "scout", bucket: "exploration", show: true, name: "Scout", cost: "Exploration", traits: ["exploration", "concentrate"], desc: "PF2E.Action.Scout.Description",
              descFallback: "You move ahead of the group to observe the area ahead. All allies gain a +1 circumstance bonus to their initiative rolls if you succeed." },
            { slug: "search", bucket: "exploration", show: true, name: "Search", cost: "Exploration", traits: ["exploration", "concentrate"], desc: "PF2E.Action.Search.Description",
              descFallback: "You systematically look around for concealed creatures, secret doors, hidden objects, and other details as you explore an area." },
            { slug: "hustle", bucket: "exploration", show: true, name: "Hustle", cost: "Exploration", traits: ["exploration", "move"], desc: "PF2E.Action.Hustle.Description",
              descFallback: "You move at double the group's travel speed. You can hustle for only 1 hour per day before risking fatigue." }
        ];

        for (const action of conditionalActions) {
            // Regra 2: Sincronia de SeenSlugs + Lógica de Filtragem (Etapa 5)
            if (!action.show || seenSlugs.has(action.slug)) continue;

            const glyph = this._getActionGlyph(action.cost);
            const fullId = `skillaction:${action.slug}`;
            const display = this._prepareActionDisplay(action.name, action.slug, glyph, fullId);
            
            const itemData = {
                id: fullId,
                name: display.html,
                img: "", 
                cost: "",
                description: await this._prepareTooltip(action.name, (() => {
                    if (!action.desc) return action.descFallback || "";
                    const loc = game.i18n.localize(action.desc);
                    return (loc === action.desc) ? (action.descFallback || "") : loc;
                })(), action.traits || []),
                tooltipData: {
                    traits: action.traits || [],
                    description: action.descFallback || action.desc || ""
                }
            };

            const [cat, sub] = action.bucket.split(".");
            if (sub) {
                if (Array.isArray(results[cat]?.[sub])) results[cat][sub].push(itemData);
            } else if (Array.isArray(results[cat])) {
                results[cat].push(itemData);
            }
            
            seenSlugs.add(action.slug);
        }

        return results;
    }

    /**
     * Replicates pf2e-hud behavior: moves Strikes inside the Actions menu.
     * They appear as the first tab/section of the submenu.
     */
    async _getSystemSubMenuData(actor, systemId, menuData) { // Overrides PF2e's _getSystemSubMenuData
        if (systemId === "shop") {
            // Abre o shop imediatamente ao clicar na categoria
            new SF2eShopBuyApplication(actor).render(true);

            // Retorna um item no sidebar que permite reabrir o shop
            return {
                title: menuData.label,
                items: [
                    {
                        id: "open-shop",
                        name: `<div style="display:flex; align-items:center; justify-content:center;
                                    gap:10px; font-family:'Teko'; font-size:1.2em; letter-spacing:0.08em;
                                    padding:4px 0;">
                                <i class="fas fa-store" style="color:#00b4d8; font-size:1.3em;"></i>
                                Open Shop
                               </div>`,
                        img: "",
                        cost: "",
                        description: "Click to open the Starfinder Market.",
                    }
                ]
            };
        }

        if (systemId === "action") {
			const actionData = await this._getActionData(actor);
			const strikeData = await super._getSystemSubMenuData(actor, "strike", menuData);

			if (!actionData) return strikeData || { title: menuData.label, items: [] };

			if (Array.isArray(actionData.items?.encounter)) {
				if (actionData.items.encounter[0]?.id === "header-attack") {
					actionData.items.encounter.shift();
				}
				actionData.items.encounter.unshift(
					{ id: "header-attack-merged", isHeader: true, name: "Attacks & Maneuvers" },
					...strikeData.items.map(item => ({
						...item,
						canFavorite: item._isUnarmed
					}))
				);
			}
			actionData.title = menuData.label;
			return actionData;
		}
		return super._getSystemSubMenuData(actor, systemId, menuData);
	}

	getDefaultLayout() {
		return [
			{
				systemId: "spell",
				label: `<span style="display: flex; align-items: center; white-space: nowrap;">Spell ${getIconHtml('menu-spell', { margin: '0 0 0 10px' })}</span>`,
				type: "submenu",
				useSidebar: true,
			},
			{
				systemId: "action",
				label: `<span style="display: flex; align-items: center; white-space: nowrap;">Skills Action ${getIconHtml('menu-action-skill', { margin: '0 0 0 10px' })}</span>`,
				type: "submenu",
				useSidebar: false,
			},
			{
				systemId: "feat",
				label: `<span style="display: flex; align-items: center; white-space: nowrap;">Feats ${getIconHtml('menu-feat', { margin: '0 0 0 10px' })}</span>`,
				type: "submenu",
				useSidebar: true,
			},
			{
				systemId: "utility",
				label: `<span style="display: flex; align-items: center; white-space: nowrap;">Checks ${getIconHtml('menu-checks', { margin: '0 0 0 10px' })}</span>`,
				type: "submenu",
				useSidebar: true,
			},
			{
				systemId: "shop",
                label: `<span style="display:flex;align-items:center;white-space:nowrap;">Shop ${getIconHtml('menu-shop',{margin:'0 0 0 10px'})}</span>`,
			},
			{
				systemId: "inventory",
				label: `<span style="display: flex; align-items: center; white-space: nowrap;">Inventory ${getIconHtml('menu-inventory', { margin: '0 0 0 10px' })}</span>`,
				type: "submenu",
				useSidebar: true,
			},
		];
	}

	async updateAttribute(actor, path, input) {
		const prop = foundry.utils.getProperty(actor, path);
		const val = (typeof prop === "object") ? prop.value : prop;
		const max = (typeof prop === "object") ? prop.max : 0;
		const numericInput = Number(input);
		let newValue = (input.startsWith("+") || input.startsWith("-")) ? val + numericInput : numericInput;

		if (path.endsWith(".hp") && newValue < val) {
			const damage = val - newValue;
			const stamina = actor.system.attributes.sp;
			if (stamina?.value > 0) {
				const spDamage = Math.min(damage, stamina.value);
				await actor.update({ "system.attributes.sp.value": stamina.value - spDamage });
				newValue = val - (damage - spDamage);
			}
		}
		const updatePath = (typeof prop === "object") ? `${path}.value` : path;
		await actor.update({ [updatePath]: max > 0 ? Math.clamp(newValue, 0, max) : Math.max(0, newValue) });
	}

	async executeAction(actor, systemId, event = null) {
		if (systemId === "shop") {
			new SF2eShopBuyApplication(actor).render(true);
			return;
		}
		return super.executeAction?.(actor, systemId, event);
	}

    /**
     * Handles the execution of new utility actions.
     */
    async useItem(actor, itemId, event = null) {
          // Normalizes the event to ensure properties (ctrl, shift) are passed correctly to the system
        const e = event || window.event || {};
        const cleanEvent = this._normalizePointerEvent(e);

        if (itemId === "open-shop") {
            const existing = Object.values(ui.windows)
                .find(w => w.id === "sf2e-shop-unified");
            if (existing) {
                existing.bringToTop();
            } else {
                new SF2eShopBuyApplication(actor).render(true);
            }
            return;
        }

        if (itemId.startsWith("sf2e-util:")) {
            const action = itemId.replace("sf2e-util:", "");
            switch (action) {
                case "use-resolve":
                    // Opens the character sheet or triggers the rest dialog if available
                    return actor.sheet.render(true);
                  case "recovery-check": { // Handles the Recovery Check action
                    const dying = actor.itemTypes.condition.find(c => c.slug === "dying");
                    const dyingVal = dying?.value ?? 0;
                    if (dyingVal === 0) {
                        ui.notifications.warn("O personagem não está em estado de Dying.");
                        return;
                    }
                    const dc = 10 + dyingVal;
                    return game.pf2e.Check.roll(
                        new game.pf2e.StatisticModifier("Recovery Check", []),
                        {
                            actor,
                            type: "flat-check",
                            dc: { value: dc },
                            label: `Recovery Check (DC ${dc})`,
                            extraRollOptions: ["recovery"],
                        },
                        cleanEvent,
                        async (roll) => {
                            const degree = roll.degreeOfSuccess;
                            if (typeof degree !== "number") return;
                            let message = "";
                            const dyingLabel = game.i18n.localize(CONFIG.PF2E.conditionTypes["dying"] || "Dying");
                              let borderColor = "#ff3333"; // Default border color for Dying messages

                            if (degree >= 2) { // Sucesso ou Sucesso Crítico
                                await actor.decreaseCondition("dying");
                                if (degree === 3) await actor.decreaseCondition("dying");
                                const currentDying = actor.itemTypes.condition.find(c => c.slug === "dying")?.value ?? 0;

                                let dyingColor = "#ff3333";
                                if (currentDying === 1) dyingColor = "#00ff00";
                                else if (currentDying === 2 || currentDying === 3) dyingColor = "#ff9900";
                                message = `<span style="color:${dyingColor};"><strong>${dyingLabel}</strong> decreased to ${currentDying}.</span>`;
                                  
                                // Regra PF2e: Se estabilizou (Dying sumiu), aumenta Wounded em 1
                                if (!actor.itemTypes.condition.some(c => c.slug === "dying")) {
                                    await actor.increaseCondition("wounded");
                                    const woundedLabel = game.i18n.localize(CONFIG.PF2E.conditionTypes["wounded"] || "Wounded");
                                    const currentWounded = actor.itemTypes.condition.find(c => c.slug === "wounded")?.value ?? 0;
                                    message += `<br><span style="color:#ff9900;"><strong>${woundedLabel}</strong> increased to ${currentWounded}.</span>`;
                                    borderColor = "#ff9900"; // Wounded color if stabilized
                                }
                            } else { // Falha ou Falha Crítica
                                await actor.increaseCondition("dying");
                                if (degree === 0) await actor.increaseCondition("dying");
                                const currentDying = actor.itemTypes.condition.find(c => c.slug === "dying")?.value ?? 0;

                                let dyingColor = "#ff3333";
                                if (currentDying === 1) dyingColor = "#00ff00";
                                else if (currentDying === 2 || currentDying === 3) dyingColor = "#ff9900";
                                message = `<span style="color:${dyingColor};"><strong>${dyingLabel}</strong> increased to ${currentDying}.</span>`;
                            }

                            if (message) {
                                await ChatMessage.create({
                                    speaker: ChatMessage.getSpeaker({ actor }),
                                    flavor: `<div style="font-family:'Teko',sans-serif; font-size:1.3em; padding: 5px 10px; border-radius: 4px; background: rgba(0, 0, 0, 0.85); border: 1px solid ${borderColor}; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${message}</div>`
                                });
                            }
                        }
                    );
                }
            }
        }

        // Quantity +/- handler for inventory items with Credit Check (SF2e rule)
        if (itemId.startsWith("qty:")) {
            const parts = itemId.split(":");
            const targetId = parts[1];
            const command = parts[2]; // "plus" or "minus"

            const item = actor.items.get(targetId);
            if (!item) return;

            const current = item.quantity ?? 0;

            if (command === "minus") {
                // MINUS: Remove item silently — no credit refund per SF2e HUD rules
                const newQty = Math.max(0, current - 1);
                if (current === 0) {
                    ui.notifications.warn(`${item.name}: quantity is already 0.`);
                    return;
                }
                await item.update({ "system.quantity": newQty });
                await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor }),
                    flavor: `<div style="font-family:'Teko',sans-serif; font-size:1.2em; padding:4px 10px; border-radius:4px; background:rgba(0,0,0,0.85); border:1px solid #666;">
                        <span style="color:#fbbf24;"><strong>${item.name}</strong></span>
                        <span style="color:#aaa;"> quantity: ${current} → ${newQty}</span>
                    </div>`
                });

            } else if (command === "plus") {
                // Item price in credits — it's in price.value.credits, not in price.value
                const priceObj = item.system?.price?.value ?? {};
                const itemPrice = typeof priceObj === "object"
                    ? Number(priceObj.credits ?? 0)
                    : Number(priceObj ?? 0);

                // Item without price - add freely
                if (itemPrice <= 0) {
                    const newQty = current + 1;
                    if (typeof item.update === "function") 
                    await item.update({ "system.quantity": newQty });
                    await ChatMessage.create({
                        speaker: ChatMessage.getSpeaker({ actor }),
                        flavor: `<div style="font-family:'Teko',sans-serif; font-size:1.2em; padding:4px 10px; border-radius:4px; background:rgba(0,0,0,0.85); border:1px solid #666;">
                            <span style="color:#4ade80;"><strong>${item.name}</strong></span>
                            <span style="color:#aaa;"> quantity: ${current} → ${newQty}</span>
                        </div>`
                    });
                    return;
                }

                // Read credits from actor.inventory.coins.credits
                const currentCredits = Number(actor.inventory?.coins?.credits ?? 0);

                // Not enough credits - block
                if (currentCredits < itemPrice) {
                    ui.notifications.warn(`Insufficient credits. Need ${itemPrice.toLocaleString()} cr, have ${currentCredits.toLocaleString()} cr.`);
                    await warnAlert({
                        message: `Insufficient credits for "${item.name}"`,
                        details: [
                            `<strong>SUBJECT:</strong> ${actor.name}`,
                            `<strong>ASSET:</strong> ${item.name}`,
                            `<strong>REQUIRED:</strong> <span style="font-size:1.2em; color:#facc15;">${itemPrice} Credits</span>`,
                            `<strong>CURRENT:</strong> <span style="font-size:1.2em; color:#ff4444;">${currentCredits} Credits</span>`,
                        ],
                        actor,
                    });
                    return;
                }

                // Enough credits - deduct and add item
                const newQty = current + 1;

                // Deduct credits via utility (Seção 4 do MD)
                await deductCredits(actor, itemPrice);
                const newCredits = currentCredits - itemPrice;
                await item.update({ "system.quantity": newQty });

                await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor }),
                    flavor: `<div style="font-family:'Teko',sans-serif; font-size:1.3em; padding:8px 14px; border-radius:4px; background:rgba(0,0,0,0.9); border:1px solid #4ade80; box-shadow: 0 0 10px rgba(74, 222, 128, 0.2);">
                        <span style="color:#4ade80; font-size: 1.1em;"><strong>${item.name}</strong> purchased ×1</span><br>
                        <div style="margin-top: 5px; padding-top: 5px; border-top: 1px dotted #444; display: flex; flex-direction: column; gap: 2px;">
                            <span style="color:#eee;">Cost: <strong style="color:#facc15; font-size: 1.2em;">${itemPrice} Credits</strong></span>
                            <span style="color:#aaa; font-size: 0.9em;">Remaining: <strong style="color:#4ade80; font-size: 1.1em;">${newCredits} Credits</strong></span>
                        </div>
                    </div>`
                });
            }
            return;
        }

        if (itemId.startsWith("sf2e-condition:")) {
            const parts = itemId.split(":");
            const conditionSlug = parts[1];
            const actionType = parts[2];

            // Execute the operation in the Starfinder/PF2e system
            if (actionType === "increase") {
                await actor.increaseCondition(conditionSlug);
            } else if (actionType === "reduce") {
                await actor.decreaseCondition(conditionSlug);
            }

            // Busca o valor atualizado após a operação
            // Fetch the updated value after the operation
            const conditionLabel = game.i18n.localize(CONFIG.PF2E.conditionTypes[conditionSlug] || conditionSlug);
            const currentVal = actor.itemTypes.condition.find(c => c.slug === conditionSlug)?.value ?? 0;
            const changeText = actionType === "increase" ? "increased" : "decreased";
            
            let textColor = "#fff";
            let borderColor = "#555";
            if (conditionSlug === "dying") {
                borderColor = "#ff3333";
                
                // Lógica Unificada: 1=Verde, 2/3=Laranja, 4+=Vermelho
                if (currentVal === 1) textColor = "#00ff00";
                else if (currentVal === 2 || currentVal === 3) textColor = "#ff9900";
                else if (currentVal >= 4) textColor = "#ff3333";
                else if (currentVal === 0 && actionType === "reduce") { textColor = "#00ff00"; borderColor = "#ff9900"; }
            } else if (conditionSlug === "wounded") {
                textColor = "#ff9900";
                borderColor = "#ff9900";
            }

            const chatContent = `<span style="color:${textColor};"><strong>${conditionLabel}</strong> ${changeText} to ${currentVal}.</span>`;

            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                flavor: `<div style="font-family:'Teko',sans-serif; font-size:1.4em; padding: 6px 12px; border-radius: 4px; background: rgba(0, 0, 0, 0.9); border: 1px solid ${borderColor}; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${chatContent}</div>`
            });
            return;
        }

        // Support for system Skill Actions (e.g., Trip, Sense Motive)
        if (itemId.startsWith("skillaction:")) {
            const parts = itemId.split(":");
            const slug = parts[1];
            const variantIdx = parts[2];
            const isChat = parts.includes("chat");
            const action = (game.pf2e.actions instanceof Map ? game.pf2e.actions.get(slug) : game.pf2e.actions.find(a => a.slug === slug)) || null; // Ensure action is null if not found

            if (!action && slug !== "follow-the-expert" && slug !== "treat-wounds") { // Added treat-wounds
                ui.notifications.warn(`Action "${slug}" not found in the system.`);
                return;
            }

            // Fallback for Follow the Expert action
            if (slug === "follow-the-expert") {
                const fteName = game.i18n.has("SF2E.Action.FollowTheExpert.Title") ? game.i18n.localize("SF2E.Action.FollowTheExpert.Title") :
                                (game.i18n.has("PF2E.Action.FollowTheExpert.Title") ? game.i18n.localize("PF2E.Action.FollowTheExpert.Title") :
                                (game.i18n.has("PF2E.Actions.FollowTheExpert.Title") ? game.i18n.localize("PF2E.Actions.FollowTheExpert.Title") : "Follow the Expert"));

                const fteTraits = ["auditory", "concentrate", "exploration", "visual"];
                const fteFullDesc = `
                    <p>Choose an ally attempting a recurring skill check while exploring, such as climbing, or performing a different exploration tactic that requires a skill check (like @UUID[Compendium.sf2e.actions.Item.IE2nThCmoyhQA0Jn]{Avoiding Notice}). The ally must be at least an expert in that skill and must be willing to provide assistance. While Following the Expert, you match their tactic or attempt similar skill checks.</p>
                    <p>Thanks to your ally's assistance, you can add your level as a proficiency bonus to the associated skill check, even if you're untrained. Additionally, you gain a circumstance bonus to your skill check based on your ally's proficiency (+2 for expert, +3 for master, and +4 for legendary).</p>
                    <p>@UUID[Compendium.sf2e.other-effects.Item.VCSpuc3Tf3XWMkd3]{Effect: Follow The Expert}</p>
                `;
                const enriched = await foundry.applications.ux.TextEditor.enrichHTML(fteFullDesc, { async: true });
                
                // Maps and generates the HTML for Traits
                const traitsHtml = fteTraits.map(t => `<span class="tag">${game.i18n.localize(CONFIG.PF2E.actionTraits[t] || t)}</span>`).join("");

                if (isChat || !action) {
                    return ChatMessage.create({
                        user: game.user.id,
                        speaker: ChatMessage.getSpeaker({ actor }),
                        content: `
                            <div class="pf2e chat-card action-card">
                                <header class="card-header">
                                <span class="material-symbols-outlined" style="font-size: 1.8em; margin-right: 8px; vertical-align: middle;">groups</span>
                                    <h3>${fteName}</h3>
                                </header>
                                <div class="card-content">
                                    <div class="tags" style="margin-bottom: 8px;">${traitsHtml}</div>
                                    ${enriched}
                                </div>
                            </div>`
                    });
                }
            }
            
            // Professional fallback for Treat Wounds
            if (slug === "treat-wounds") {
                if (!isChat && typeof game.pf2e.actions.treatWounds === "function") {
                    return game.pf2e.actions.treatWounds({ 
                        event: cleanEvent, 
                        actors: [actor] 
                    });
                }

                  // Fallback to display the Chat Card (used by the chat bubble icon or if the function fails)
                const twName = game.i18n.localize("PF2E.Actions.TreatWounds.Label") || 
                               game.i18n.localize("PF2E.Action.TreatWounds") || "Treat Wounds";

                const twTraits = ["concentrate", "exploration", "healing", "manipulate"];
                const enriched = await foundry.applications.ux.TextEditor.enrichHTML(Starfinder2eAdapter.TREAT_WOUNDS_DESCRIPTION_HTML, { async: true });
                const traitsHtml = twTraits.map(t => `<span class="tag">${game.i18n.localize(CONFIG.PF2E.actionTraits[t] || t)}</span>`).join("");

                return ChatMessage.create({
                    user: game.user.id,
                    speaker: ChatMessage.getSpeaker({ actor }),
                    content: `<div class="pf2e chat-card action-card">
                        <header class="card-header">
                        ${getIconHtml('treat-wounds', { size: '1.8em', margin: '0 8px 0 0', color: 'var(--color-text-dark-primary)', extraStyle: 'vertical-align: middle;' })}
                            <h3>${twName}</h3>
                        </header>
                        <div class="card-content">
                            <div class="tags" style="margin-bottom: 8px;">${traitsHtml}</div>
                            ${enriched}
                        </div>
                    </div>`
                });
            }

              // Try to trigger the action. If isChat, force the card.
            const options = { event: cleanEvent, actors: [actor] };
            if (variantIdx !== undefined) {
                if (['trip', 'grapple', 'shove', 'reposition', 'disarm', 'escape', 'force-open'].includes(slug)) {
                    options.mapIncreases = parseInt(variantIdx);
                } else if (slug === 'administer-first-aid') {
                    options.variant = variantIdx === "0" ? "stabilize" : "stop-bleeding";
                } else if (slug === 'recall-knowledge') {
                    return this._showRecallKnowledgeDialog(actor);
                } else {
                      options.variant = parseInt(variantIdx); // Set the variant index for the action
                }
            } else if (slug === 'administer-first-aid') {
                // Se clicado diretamente sem variante, força exibição no chat para escolha
                return action.toMessage({ actors: [actor] });
            }
            
            if (isChat) {
                if (typeof action.toMessage === "function") return action.toMessage({ actors: [actor] });
                options.event = { shiftKey: true };
            }

              // Perform the test (roll/use)
            return action.use(options);
        }

        // Intercepts inventory item clicks to open the sheet (info) 
        // instead of opening the Strike Dialog (for weapons) or using the item automatically.
        const parts = itemId.split("_");
        const realItemId = parts[0];
        const command = parts.includes("chat") ? "chat" : (parts.length > 1 ? parts[1] : null);

        // If it's a direct click on the item (no attack/damage command) and no system prefixes
        if (!command && !itemId.includes(":") && !itemId.startsWith("macro-") && !itemId.startsWith("blast_")) {
            let item = actor.items.get(realItemId);
            if (!item) item = this.findSyntheticItem(actor, realItemId);

              if (item) { // If the item exists
                const infoTypes = ["armor", "shield", "equipment", "consumable", "treasure", "backpack", "ammo", "augmentation", "upgrade"];
                if (infoTypes.includes(item.type)) {
                    return item.sheet.render(true);
                }

                // Main logic: Send Feats and Actions to chat as in Token Action HUD
                // This renders the rich card (action-card.hbs) with the full description.
                if (["feat", "action"].includes(item.type)) {
                    // Shortcut: Shift + Click opens the original item sheet
                    if (cleanEvent.shiftKey) return item.sheet.render(true);

                    // Prioritize use() to trigger checks/tests
                    if (typeof item.use === "function") return item.use({ event: e });
                    if (typeof item.toChat === "function") return item.toChat(e);
                    return item.sheet.render(true);
                }
            }
        }

        // Handles the chat command for items (Feats, Actions, Inventory)
        if (command === "chat") {
            const item = actor.items.get(realItemId) || this.findSyntheticItem(actor, realItemId);
            if (item) {
                if (typeof item.toChat === "function") return item.toChat(e);
                return item.use({ event: { shiftKey: true } });
            }
        }

        return super.useItem(actor, itemId, cleanEvent);
    }

    async _handleItem(actor, itemId, event, context = {}) {
        const item = actor.items.get(itemId) || this.findSyntheticItem(actor, itemId);
        // Ensures secondary triggers (like shortcuts) also use the rich Action Card
        if (item && ["feat", "action"].includes(item.type)) {
            if (typeof item.toChat === "function") return item.toChat(event);
            if (typeof item.use === "function") return item.use({ event });
        }
        return super._handleItem(actor, itemId, event, context);
    }

    /**
       * Logic for Recall Knowledge: opens a skill selection dialog and performs the roll.
     */
    async _showRecallKnowledgeDialog(actor) {
        const idSkills = [
            { slug: "arcana", label: "Arcana" },
            { slug: "computers", label: "Computers" },
            { slug: "crafting", label: "Crafting" },
            { slug: "medicine", label: "Medicine" },
            { slug: "nature", label: "Nature" },
            { slug: "occultism", label: "Occultism" },
            { slug: "religion", label: "Religion" },
            { slug: "society", label: "Society" }
        ];
        const lores = actor.itemTypes.lore.map(l => ({ slug: l.slug || l.name.slugify(), label: l.name, isLore: true }));
        const allSkills = [...idSkills, ...lores];
          let content = `<div style="padding:10px; color:#ccc; text-align:center; font-family:'Oswald';">Knowledge Check: Select Skill</div>`; // Dialog title
        content += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; padding:10px; max-height: 450px; overflow-y: auto;">`;
        allSkills.forEach(s => {
            const skill = actor.skills[s.slug];
            if (!skill) return;
            const mod = skill.mod ?? skill.totalModifier ?? 0;
            const color = s.isLore ? "#c084fc" : "#fff";
            
            content += `
            <div style="background:rgba(0,0,0,0.4); border:1px solid #444; padding:8px; border-radius:4px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-family:'Teko'; font-size:1.1em; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                    <span style="color:${color};">${s.label}</span>
                    <span style="color:#00ff00;">${mod >= 0 ? '+' : ''}${mod}</span>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
                    <button type="button" data-action="rollRecall" data-skill="${s.slug}" data-mode="public" 
                        style="background:rgba(78, 205, 196, 0.2); border:1px solid #4ecdc4; color:#fff; font-family:'Oswald'; font-size:0.75em; cursor:pointer; padding:4px 2px;">CONCENTRATE</button>
                    <button type="button" data-action="rollRecall" data-skill="${s.slug}" data-mode="secret" 
                        style="background:rgba(192, 132, 252, 0.2); border:1px solid #c084fc; color:#fff; font-family:'Oswald'; font-size:0.75em; cursor:pointer; padding:4px 2px;">SECRET</button>
                </div>
            </div>`;
        });
        content += `</div>`;
        const { DialogV2 } = foundry.applications.api;
        new DialogV2({
            window: { title: "Recall Knowledge", icon: "fas fa-brain" },
            content: content,
            buttons: [{ action: "close", label: "Fechar", icon: "fas fa-times" }],
            actions: {
                rollRecall: function(event, target) {
                    const skillSlug = target.dataset.skill;
                    const mode = target.dataset.mode;
                    if (skillSlug && actor.skills[skillSlug]) {
                        const rollOptions = { event };
                        if (mode === 'secret') rollOptions.rollMode = 'blindroll';
                        actor.skills[skillSlug].roll(rollOptions);
                        this.close();
                    }
                }
            }
        }).render(true);
    }
}

/** Paleta de cores otimizada para RPG e Starfinder */
const SF2E_COLOR_PALETTE = [ // Optimized color palette for RPG and Starfinder
    { hex: "#c084fc", label: "Roxo Starfinder (Padrão)" },
    { hex: "#4a6ea2", label: "Azul Pathfinder" },
    { hex: "#ff4500", label: "Vermelho Crítico" },
    { hex: "#05FF00", label: "Acid Green" },
    { hex: "#F3E600", label: "Cyber Yellow" },
    { hex: "#FF00FF", label: "Neon Pink " }
];

// Helper function to convert hex color to RGB string (e.g., "192, 132, 252")
function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
}

// Function to inject CSS variables for the checks color into the document's root
function _injectChecksColorVariables() {
    const checksColorHex = game.settings.get("stylish-bridge-sf2e", "checksColor");
    const checksColorRgb = hexToRgb(checksColorHex);

    document.documentElement.style.setProperty('--sf2e-checks-color', checksColorHex);
    if (checksColorRgb) {
        document.documentElement.style.setProperty('--sf2e-checks-color-rgb', checksColorRgb);
    }
}

// Register module settings during Foundry's initialization phase
Hooks.once("init", () => {
	const modId = "stylish-bridge-sf2e";

	game.settings.register(modId, "checksColor", {
		name: "Bonus Color (Checks Menu)",
		hint: "Defines the color of numbers in the 'Checks' tab. Purple (#c084fc) is the visual default for Starfinder 2e.",
        scope: "world",
        config: true,
        type: String,
        default: "#c084fc",
        color: true,
        onChange: () => _injectChecksColorVariables()
    });

    game.settings.register(modId, "sellRatio", {
        name: "Percentual de Venda",
        hint: "Quanto o jogador recebe ao vender um item (0.1 a 1.0). Padrão: 0.5 = 50% do valor.",
        scope: "world",
        config: true,
        type: Number,
        range: { min: 0.1, max: 1.0, step: 0.05 },
        default: 0.5,
    });

    game.settings.register(modId, "enableShopLog", {
        name: "Ativar Log de Transações",
        hint: "Cria e atualiza um Journal público com o histórico de compras e vendas.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register(modId, "allowPlayerSell", {
        name: "Jogadores Podem Vender",
        hint: "Se desativado, apenas o GM pode realizar vendas.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register(modId, "debugMode", {
        name: "Debug Mode",
        hint: "Enable detailed logging in the console for troubleshooting.",
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
    });
});

Hooks.on("renderSettingsConfig", (app, html, data) => {
    const root = html instanceof HTMLElement ? html : html[0];
    const colorInput = root.querySelector('input[name$="checksColor"]');
    if (!colorInput) return;

    const formGroup = colorInput.closest('.form-group');
    if (!formGroup) return;

    // Step 1: Hide the original input
    colorInput.style.display = 'none';

    // Step 2: Create the clickable swatch
    const swatch = document.createElement('div'); // Color swatch element
    swatch.style.cssText = `
        width: 28px; height: 28px; border: 1px solid #444; border-radius: 4px;
        cursor: pointer; background: ${colorInput.value}; display: inline-block; vertical-align: middle;
        box-shadow: 0 0 4px rgba(0,0,0,0.5);
    `;
    colorInput.after(swatch);

    // Step 4: Conversion functions (Hex to HSV, HSV to RGB, HSV to Hex, RGB to HSV)
    const hexToHsv = (hex) => {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max, d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) h = 0;
        else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    };

    const hsvToRgb = (h, s, v) => {
        s /= 100; v /= 100; h /= 360;
        let i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
        let r, g, b;
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    };

    const hsvToHex = (h, s, v) => {
        const { r, g, b } = hsvToRgb(h, s, v);
        return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    };

    const rgbToHsv = (r, g, b) => {
        r /= 255; g /= 255; b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max, d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) h = 0;
        else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    };

    // Local state of the color picker
    let hsv = hexToHsv(colorInput.value);

    swatch.addEventListener('click', (e) => {
        if (document.getElementById('sf2e-floating-picker')) return;

        // Step 3: HTML structure of the color picker
        const picker = document.createElement('div'); // Floating color picker element
        picker.id = 'sf2e-floating-picker';
        picker.style.cssText = `
            position: fixed; z-index: 99999; width: 220px; background: #222; border: 1px solid #444;
            border-radius: 8px; padding: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            display: flex; flex-direction: column; gap: 10px; font-family: 'Oswald', sans-serif;
        `;

        const rect = swatch.getBoundingClientRect();
        picker.style.top = `${rect.bottom + 8}px`;
        picker.style.left = `${rect.left}px`;

        // Step 5: 2D Gradient area (Saturation and Value)
        const gradContainer = document.createElement('div');
        gradContainer.style.cssText = `position: relative; height: 120px; width: 100%; border-radius: 4px; cursor: crosshair; overflow: hidden;`;
        const hueBg = document.createElement('div');
        hueBg.style.cssText = `position: absolute; inset: 0; background: linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%));`;
        const blackBg = document.createElement('div');
        blackBg.style.cssText = `position: absolute; inset: 0; background: linear-gradient(to bottom, transparent, #000);`;
        const cursor = document.createElement('div');
        cursor.style.cssText = `position: absolute; width: 8px; height: 8px; border: 2px solid #fff; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; box-shadow: 0 0 2px #000;`;

        gradContainer.append(hueBg, blackBg, cursor);

        // Control row (Eyedropper, Preview, Hue Slider)
        const midRow = document.createElement('div');
        midRow.style.cssText = `display: flex; align-items: center; gap: 8px;`;
        
        const eyedropperBtn = document.createElement('div');
        eyedropperBtn.innerHTML = '<i class="fas fa-eye-dropper"></i>';
        eyedropperBtn.style.cssText = `cursor: pointer; color: #ccc; font-size: 14px; display: ${'EyeDropper' in window ? 'block' : 'none'}`;

        const preview = document.createElement('div');
        preview.style.cssText = `width: 24px; height: 24px; border-radius: 50%; border: 1px solid #444; background: ${colorInput.value}; flex-shrink: 0;`;

        const hueSlider = document.createElement('div');
        hueSlider.style.cssText = `flex: 1; height: 10px; border-radius: 5px; background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); position: relative; cursor: pointer;`;
        const hueCursor = document.createElement('div');
        hueCursor.style.cssText = `position: absolute; top: -2px; width: 4px; height: 14px; background: #fff; border: 1px solid #000; border-radius: 2px; transform: translateX(-50%); pointer-events: none;`;
        hueSlider.appendChild(hueCursor);

        midRow.append(eyedropperBtn, preview, hueSlider);

        // Step 3: RGB Inputs
        const rgbRow = document.createElement('div');
        rgbRow.style.cssText = `display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;`;
        const createRgbInput = (label) => {
            const container = document.createElement('div');
            container.style.cssText = `display: flex; flex-direction: column; align-items: center; gap: 2px;`;
            const span = document.createElement('span');
            span.textContent = label; span.style.fontSize = '10px'; span.style.color = '#888';
            const input = document.createElement('input');
            input.type = 'number'; input.min = 0; input.max = 255;
            input.style.cssText = `width: 100%; background: #333; border: 1px solid #444; color: #fff; font-size: 11px; text-align: center; padding: 2px; border-radius: 3px;`;
            container.append(span, input);
            return { container, input };
        };
        const rIn = createRgbInput('R'), gIn = createRgbInput('G'), bIn = createRgbInput('B');
        rgbRow.append(rIn.container, gIn.container, bIn.container);

        // Step 12: Keep compact palette
        const quickPalette = document.createElement('div');
        quickPalette.style.cssText = `display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-top: 4px; border-top: 1px solid #444; padding-top: 8px;`;
        SF2E_COLOR_PALETTE.forEach(c => {
            const pItem = document.createElement('div');
            pItem.style.cssText = `height: 16px; background: ${c.hex}; border-radius: 2px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);`;
            pItem.title = c.label;
            pItem.addEventListener('click', () => updateAll(hexToHsv(c.hex)));
            quickPalette.appendChild(pItem);
        });

        picker.append(gradContainer, midRow, rgbRow, quickPalette);
        document.body.appendChild(picker);

        // General Synchronization
        const updateUI = () => {
            const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
            const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
            
            // Elementos do Picker
            hueBg.style.background = `linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`;
            cursor.style.left = `${hsv.s}%`;
            cursor.style.top = `${100 - hsv.v}%`;
            hueCursor.style.left = `${(hsv.h / 360) * 100}%`;
            preview.style.background = hex;
            rIn.input.value = r; gIn.input.value = g; bIn.input.value = b;

            // Step 10: Synchronize with original input
            colorInput.value = hex;
            colorInput.dispatchEvent(new Event('change'));
            swatch.style.background = hex;
        };

        const updateAll = (newHsv) => { hsv = newHsv; updateUI(); }; // Update all elements with new HSV values

        // Passo 6: Eventos Drag Gradiente
        const handleGrad = (e) => {
            const b = gradContainer.getBoundingClientRect();
            const s = Math.max(0, Math.min(100, ((e.clientX - b.left) / b.width) * 100));
            const v = Math.max(0, Math.min(100, 100 - ((e.clientY - b.top) / b.height) * 100));
            updateAll({ ...hsv, s, v });
        };

        gradContainer.addEventListener('mousedown', (e) => {
            handleGrad(e);
            const move = (me) => handleGrad(me);
            const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });

        // Step 7: Hue Drag Events
        const handleHue = (e) => {
            const b = hueSlider.getBoundingClientRect();
            const h = Math.max(0, Math.min(360, ((e.clientX - b.left) / b.width) * 360));
            updateAll({ ...hsv, h });
        };

        hueSlider.addEventListener('mousedown', (e) => {
            handleHue(e);
            const move = (me) => handleHue(me);
            const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });

        // Step 8: RGB Events
        [rIn, gIn, bIn].forEach(item => {
            item.input.addEventListener('input', () => {
                let r = parseInt(rIn.input.value) || 0, g = parseInt(gIn.input.value) || 0, b = parseInt(bIn.input.value) || 0;
                r = Math.clamp(r, 0, 255); g = Math.clamp(g, 0, 255); b = Math.clamp(b, 0, 255);
                updateAll(rgbToHsv(r, g, b));
            });
        });

        // Step 9: Eyedropper functionality
        eyedropperBtn.addEventListener('click', async () => {
            try {
                const result = await new EyeDropper().open();
                updateAll(hexToHsv(result.sRGBHex));
            } catch (e) {}
        });

        // Step 11: Close when clicking outside
        const outsideClick = (e) => {
            if (!picker.contains(e.target) && e.target !== swatch) {
                picker.remove();
                document.removeEventListener('mousedown', outsideClick);
            }
        };
        document.addEventListener('mousedown', outsideClick);

        updateUI(); // Init
    });

    // Reset Button (Kept as requested, but adapted to update the new swatch)
    const resetBtn = document.createElement('button');
    resetBtn.type = "button";
    resetBtn.innerHTML = '<i class="fas fa-undo"></i> Reset';
    resetBtn.style.cssText = `margin-left: 8px; font-family: 'Oswald'; height: 28px; padding: 0 10px; cursor: pointer; background: #333; border: 1px solid #444; color: #eee; border-radius: 4px;`;
    swatch.after(resetBtn);
    
    resetBtn.addEventListener('click', () => {
        colorInput.value = "#c084fc"; // Default Starfinder purple
        colorInput.dispatchEvent(new Event('change'));
        swatch.style.background = "#c084fc";
        hsv = hexToHsv("#c084fc");
        ui.notifications.info("Resetado para o padrão Starfinder (#c084fc).");
    });

    // Botão Aplicar (Mantido para compatibilidade de fluxo)
    // Apply Button (Maintained for flow compatibility)
    const applyBtn = document.createElement('button');
    applyBtn.type = "button";
    applyBtn.innerHTML = '<i class="fas fa-check"></i> Apply';
    applyBtn.style.cssText = `margin-left: 5px; font-family: 'Oswald'; height: 28px; padding: 0 10px; cursor: pointer; background: rgba(78, 205, 196, 0.2); border: 1px solid #4ecdc4; color: #eee; border-radius: 4px;`;
    resetBtn.after(applyBtn);
    
    applyBtn.addEventListener('click', () => {
        const hex = colorInput.value;
        const rgb = hexToRgb(hex);
        if (rgb) document.documentElement.style.setProperty('--sf2e-checks-color-rgb', rgb);
        ui.notifications.info(`Cor ${hex} aplicada temporariamente. Salve as configurações para confirmar.`);
    });
});

Hooks.once("stylish-action-hud.apiReady", api => {
    // Registers the adapter for the sf2e system
    api.registerSystemAdapter("sf2e", Starfinder2eAdapter);

    debugLog("Adapter initialized successfully.");
});

// Inject the CSS variables once Foundry VTT is ready
Hooks.on("ready", () => {
    _injectChecksColorVariables();
    getOrCreateShopJournal();
});