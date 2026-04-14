/* scripts/main.js */
import { Pf2eAdapter } from "./pf2e.js";

/**
 * Adaptador de Sistema para Starfinder 2e
 * Atua como uma ponte (bridge) sobre o motor do PF2e
 */
class Starfinder2eAdapter extends Pf2eAdapter {
    constructor() {
        super();
        this.systemId = "sf2e";
    }

    /**
     * Mapeamento centralizado de ícones do RPG Awesome para ações do Starfinder 2e.
     * Facilita a manutenção e evita duplicidade no código.
     */
    static RPG_AWESOME_ICONS = {
        // --- ENCOUNTER: OFFENSIVE ---
        'strike': 'ra ra-fist-raised',
        'disarm': 'ra ra-broken-shield',
        'grapple': 'ra ra-muscle-up',
        'shove': 'ra ra-falling',
        'trip': 'ra ra-bottom-right',
        'reposition': 'ra ra-player-teleport',
        'feint': 'ra ra-player-dodge',
        'escape': 'ra ra-feathered-wing',
        'area-fire': 'ra ra-small-fire',
        'auto-fire': 'ra ra-bullets',

        // --- ENCOUNTER: MOVEMENT ---
        'stride': 'ra ra-shoe-prints',
        'step': 'ra ra-player',
        'stand': 'ra ra-aura',
        'leap': 'ra ra-cat',
        'crawl': 'ra ra-snail',
        'fly': 'ra ra-batwings',
        'burrow': 'ra ra-shovel',
        'mount': 'ra ra-horseshoe',
        'push-off': 'ra ra-boot-prints',

        // --- ENCOUNTER: DEFENSE & SUPPORT ---
        'seek': 'ra ra-eye-monster',
        'sense-motive': 'ra ra-brain-freeze',
        'interact': 'ra ra-speech-bubble',
        'take-cover': 'ra ra-vest',
        'raise-a-shield': 'ra ra-shield',
        'avert-gaze': 'ra ra-bleeding-eye',
        'ready': 'ra ra-hourglass',
        'delay': 'ra ra-hourglass',
        'release': 'ra ra-hand',
        'point-out': 'ra ra-hand-emblem',
        'dismiss': 'ra ra-cycle',
        'sustain-a-spell': 'ra ra-clockwise-rotation',
        'sustain': 'ra ra-tower',

        // --- SKILL ACTIONS (COMBAT & GENERAL) ---
        'balance': 'ra ra-player',
        'tumble-through': 'ra ra-player-pain',
        'maneuver-in-flight': 'ra ra-bird-claw',
        'climb': 'ra ra-player-lift',
        'force-open': 'ra ra-double-team',
        'high-jump': 'ra ra-boot-stomp',
        'long-jump': 'ra ra-player-thunder-struck',
        'swim': 'ra ra-anchor',
        'recall-knowledge': 'ra ra-book',
        'disable-a-device': 'ra ra-gear-hammer',
        'create-a-diversion': 'ra ra-bomb-explosion',
        'demoralize': 'ra ra-player-despair',
        'administer-first-aid': 'ra ra-health-increase',
        'treat-poison': 'ra ra-medical-pack',
        'command-an-animal': 'ra ra-rabbit',
        'perform': 'ra ra-horn-call',
        'hide': 'ra ra-uncertainty',
        'sneak': 'ra ra-shoe-prints',
        'steal': 'ra ra-hood',

        // --- STARFINDER SPECIALTY ---
        'drive': 'ra ra-compass',
        'stop': 'ra ra-interdiction',
        'stunt': 'ra ra-ship-emblem',
        'take-control': 'ra ra-hand',
        'run-over': 'ra ra-player-teleport',
        'recharge': 'ra ra-battery-100',
        'access-infosphere': 'ra ra-cog',
        'hack': 'ra ra-nuclear',
        'operate-device': 'ra ra-gear-hammer',
        'livestream': 'ra ra-broadcast',

        // --- EXPLORATION & DOWNTIME ---
        'analyze-environment': 'ra ra-bird-mask',
        'avoid-notice': 'ra ra-player-pyromaniac',
        'defend': 'ra ra-eye-shield',
        'detect-magic': 'ra ra-crystal-ball',
        'scout': 'ra ra-eye-monster',
        'search': 'ra ra-magnifying-glass',
        'hustle': 'ra ra-running',
        'follow-the-expert': 'ra ra-archery-target',
        'repair': 'ra ra-gear-hammer',
        'craft': 'ra ra-gear-hammer',
        'earn-income': 'ra ra-gem',
        'treat-disease': 'ra ra-pill',
        'subsist': 'ra ra-coffee-mug',
        'create-forgery': 'ra  ra-forging'
    };

    /** Lista de perícias padrão para detecção de ícones e rótulos */
    static SKILL_TRAITS = [
        'acrobatics', 'arcana', 'athletics', 'computers', 'crafting', 'deception', 'diplomacy',
        'intimidation', 'medicine', 'nature', 'occultism', 'performance', 'piloting',
        'religion', 'society', 'stealth', 'survival', 'thievery'
    ];

    /**
     * Gera uma descrição rica para o tooltip do HUD, incluindo raridade e traços,
     * similar à lógica de tooltips do Token Action HUD PF2e.
     */
    async _prepareTooltip(name, description, traits = [], rarity = null) {
        if (!description && (!traits || traits.length === 0)) return "";

        // Tenta localizar a descrição caso seja uma chave de tradução (comum em ações do sistema)
        const finalDescription = game.i18n.localize(description || "");

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

        const tooltipHtml = `<div>${header}<div class="description" style="font-size: 0.95em; line-height: 1.4;">${finalDescription}</div></div>`;

        // Processa o HTML para ativar links de compêndio, ícones de ação e rolagens inline
        return await foundry.applications.ux.TextEditor.implementation.enrichHTML(tooltipHtml, { async: true });
    }

    /**
     * Helper para preparar o visual da ação (nome limpo + ícone único)
     */
    _prepareActionDisplay(name, slug, glyph = "", fullId = "") {
        const cleanName = name.replace(/\s*\(P?S?F2E\.Skill\.[^)]+\)/gi, "");
        let raClass = Starfinder2eAdapter.RPG_AWESOME_ICONS[slug];

        // Fallback para garantir que o ícone de chat (hover) sempre tenha um container
        if (!raClass) raClass = "fa-solid fa-dice-d20";

        // Container que alterna entre o ícone da ação e o ícone de chat no hover. 
        // O ícone de chat agora tem pointer-events:auto e dispara o toChat.
        const iconHtml = `
            <div class="sf2e-hud-icon-wrapper" style="position:relative; margin-right: 12px; width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center;">
                <i class="${raClass} sf2e-base-icon" style="font-size:1.1em; transition: opacity 0.15s;"></i>
                <i class="fa-solid fa-comment-alt sf2e-chat-icon" onclick="event.stopPropagation(); StylishAction.useItem('${fullId}:chat', event)" style="position:absolute; opacity:0; transition: opacity 0.15s; color: #00d2ff; font-size: 1.1em; cursor:pointer; pointer-events:auto;"></i>
            </div>`;

        return {
            hasRaIcon: !!raClass,
            html: `<div class="sf2e-action-item-row" style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:10px;">
                    <span style="font-size:1.0em; font-weight:bold; line-height:1.2; text-align:left; display: flex; align-items: center;">${iconHtml}${cleanName}</span>
                    <span style="margin-left:auto; display:flex; align-items:center;">${glyph}</span>
                   </div>`
        };
    }

    // Atributos principais na barra do HUD (Party HUD / Player Card)
    getDefaultAttributes() {
        return [
            { path: "system.attributes.hp", label: "HP", color: "#e61c34", style: "bar", icon: "ra ra-health" },
            { path: "system.attributes.sp", label: "SP", color: "#18d4f3", style: "bar", icon: "ra ra-lightning-bolt" },
            { path: "system.attributes.ac.value", label: "AC", color: "#ffffff", style: "badge", icon: "ra ra-shield" },
            { path: "system.resources.rp", label: "RP", color: "#f1c40f", style: "badge", icon: "ra ra-atom", badgeScale: 1.0 },
        ];
    }

    // Adiciona atributos rastreáveis específicos do SF2e
    getTrackableAttributes(actor) {
        const stats = super.getTrackableAttributes(actor);
        const s = actor.system;

        if (s.attributes?.sp) {
            stats.push({ path: "system.attributes.sp", label: "Stamina Points (SP)" });
        }
        if (s.resources?.rp) stats.push({ path: "system.resources.rp", label: "Resolve Points (RP)", style: "badge", icon: "ra ra-atom" });

        return stats;
    }

    /* -----------------------------------------
       4. INVENTORY (Consumables & Gear)
       ----------------------------------------- */
    _getInventoryData(actor) {
        const categories = {
            weapon: {
                label: `${game.i18n.localize("IBHUD.Pf2e.InvWeapons") || "Weapons"} <i class='ra ra-crossed-swords' style='margin-left: 8px;'></i>`,
                tooltip: game.i18n.localize("IBHUD.Pf2e.InvWeapons") || "Weapons",
            },
            armor: {
                label: `${game.i18n.localize("IBHUD.Pf2e.InvArmor") || "Armor"} <i class='ra ra-shield' style='margin-left: 8px;'></i>`,
                tooltip: game.i18n.localize("IBHUD.Pf2e.InvArmor") || "Armor",
            },
            augmentation: {
                label: `Augmentations <i class='ra ra-pulse' style='margin-left: 8px;'></i>`,
                tooltip: "Augmentations (Cybernetics & Biotech)",
            },
            upgrade: {
                label: `Upgrades <i class='ra ra-cog' style='margin-left: 8px;'></i>`,
                tooltip: "Armor Upgrades & Weapon Fusions",
            },
            consumable: {
                label: `${game.i18n.localize("IBHUD.Pf2e.InvConsumables") || "Consumables"} <i class='ra ra-potion' style='margin-left: 8px;'></i>`,
                tooltip: game.i18n.localize("IBHUD.Pf2e.InvConsumables") || "Consumables",
            },
            equipment: {
                label: `${game.i18n.localize("IBHUD.Pf2e.InvEquipment") || "Equipment"} <i class='ra ra-gear-hammer' style='margin-left: 8px;'></i>`,
                tooltip: game.i18n.localize("IBHUD.Pf2e.InvEquipment") || "Equipment",
            },
            treasure: {
                label: `${game.i18n.localize("IBHUD.Pf2e.InvTreasure") || "Treasure"} <i class='ra ra-gem' style='margin-left: 8px;'></i>`,
                tooltip: game.i18n.localize("IBHUD.Pf2e.InvTreasure") || "Treasure",
            },
            backpack: {
                label: `${game.i18n.localize("IBHUD.Pf2e.InvContainers") || "Containers"} <i class='ra ra-backpack' style='margin-left: 8px;'></i>`,
                tooltip: game.i18n.localize("IBHUD.Pf2e.InvContainers") || "Containers",
            },
            ammo: {
                label: `Ammunition <i class='ra ra-bullets' style='margin-left: 8px;'></i>`,
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
            subLabels[key] = { all: "All Items" };
        });

        // Adicionado suporte a 'augmentation' e 'upgrade'
        const physicalItems = actor.items.filter((i) =>
            [
                "weapon",
                "armor",
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
                name: i.name,
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
        const canGrip = ["weapon", "armor", "equipment", "consumable", "treasure", "backpack", "augmentation"].includes(item.type);
        const canWear = ["weapon", "armor", "equipment", "consumable", "treasure", "backpack", "augmentation"].includes(item.type) || usageValue.includes("worn");
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

        const carryStateLabel = carryType === "held"
            ? `${localize("IBHUD.Pf2e.ActionHeld", "Held")} ${handsHeld >= 2 ? handsLabel2 : handsLabel1}`
            : carryType === "worn"
                ? (isArmorWorn ? localize("IBHUD.Pf2e.ActionWearArmor", "Wear Armor") : localize("IBHUD.Pf2e.ActionWear", "Wear"))
                : carryType === "dropped" ? localize("IBHUD.Pf2e.ActionDrop", "Drop") : localize("IBHUD.Pf2e.ActionStow", "Stow");

        return this._buildInventoryManageButton(item.id, carryType, handsHeld, carryStateLabel, options);
    }

    /**
     * Injeta as utilidades mantendo os Saves, Toggles e Macros nativos.
     * O Stylish HUD separa isso em abas: Saves, Skills, Toggles, Other.
     */
    _getUtilityData(actor) {
        // Obtém os dados base (Saves, Skills, Toggles, Other, Macro)
        const data = super._getUtilityData(actor);
        const assetPath = "modules/sf2e-stylish-action-hud/assets/actions";

        // 1. Processamento de Perícias (Skills & Lore)
        if (data.items?.skill) {
            if (data.items.skill.all) {
                data.items.skill.all.forEach(item => {
                    // Limpa os nomes das perícias padrão
                    if (item.name) item.name = item.name.replace(/\s*\(P?S?F2E\.Skill\.[^)]+\)/gi, "");
                    // Usa o ícone do sistema ou um fallback seguro do Core Foundry
                    item.img = item.img || "icons/svg/d20.svg";
                });
            }

            // Cria a sub-aba separada para Lore
            data.items.skill.lore = [];
            actor.itemTypes.lore.forEach(lore => {
                const mod = lore.system.mod?.value ?? lore.system.value ?? 0;
                data.items.skill.lore.push({
                    id: `skill-${lore.slug || lore.id}`,
                    name: lore.name,
                    img: lore.img || "icons/svg/d20.svg",
                    cost: `${mod >= 0 ? "+" : ""}${mod}`,
                    description: game.i18n.format("PF2E.SkillCheckWithName", { skillName: lore.name })
                });
            });

            // Define os rótulos das sub-abas para separação visual
            if (!data.subTabLabels.skill) {
                data.subTabLabels.skill = {};
            }
            data.subTabLabels.skill = {
                all: `${game.i18n.localize("PF2E.SkillsLabel") || "Skills"} <i class='ra ra-dice-six' style='margin-left: 10px;'></i>`,
                lore: `Lore Skills <i class='ra ra-scroll' style='margin-left: 10px;'></i>`
            };

            data.items.skill.lore.sort((a, b) => a.name.localeCompare(b.name));
        }

        // 2. Outras utilidades (Resolve e GM Tools)
        if (data.items?.other?.all) {
            data.items.other.all.push({
                id: "sf2e-util:use-resolve",
                name: "Use Resolve Points",
                img: "icons/svg/d20.svg", // Fallback seguro
                cost: "RP",
                description: "Spend Resolve Points for stamina recovery or stabilization."
            });
        }

        return data;
    }

    /**
     * Corrige nomes de ações e injeta ícones customizados da pasta assets/actions
     */
    async _getActionData(actor) {
        // Encounter Slugs
        const slugsAttack = ['strike', 'escape', 'disarm', 'grapple', 'shove', 'trip', 'reposition', 'feint', 'area-fire', 'auto-fire'];
        const slugsMovement = ['stride', 'step', 'stand', 'crawl', 'leap'];
        const slugsInteractPercept = ['interact', 'seek', 'sense-motive', 'point-out'];
        const slugsDefenseSupport = ['take-cover', 'raise-a-shield', 'avert-gaze', 'ready'];
        const slugsSpecialty = ['burrow', 'fly', 'mount', 'push-off', 'dismiss', 'sustain'];
        const slugsSkillCombat = [
            'balance', 'tumble-through', 'maneuver-in-flight', 'climb', 'force-open', 'high-jump', 'long-jump', 'swim',
            'recall-knowledge', 'disable-a-device', 'create-a-diversion', 'demoralize', 'administer-first-aid',
            'treat-poison', 'command-an-animal', 'perform', 'hide', 'sneak', 'steal',
            'drive', 'stop', 'stunt', 'take-control', 'run-over'
        ];
        const slugsReactions = ['aid', 'arrest-a-fall', 'grab-an-edge'];
        const slugsFreeActions = ['delay', 'release'];

        // Exploration Slugs
        const slugsExploration = [
            'analyze-environment', 'avoid-notice', 'defend', 'detect-magic', 'scout', 'search',
            'hustle', 'follow-the-expert', 'sustain-an-effect', 'repeat-a-spell',
            'livestream', 'recharge', 'access-infosphere', 'operative-device', 'hack',
            'squeeze', 'borrow-an-arcane-spell', 'decipher-writing', 'identify-magic', 'learn-a-spell', 'repair',
            'impersonate', 'gather-information', 'make-an-impression', 'coerce', 'treat-wounds',
            'navigate', 'plot-course', 'sense-direction', 'cover-tracks', 'track'
        ];

        // Downtime Slugs
        const slugsDowntime = ['craft', 'earn-income', 'treat-disease', 'subsist', 'create-forgery'];

        // Skill Action Mapping logic removed to avoid redundancy

        const seenSlugs = new Set();

        // Buckets temporários para organizar antes de achatar
        const buckets = {
            encounter: {
                attack: [],
                movement: [],
                interact_percept: [],
                defense_support: [],
                specialty: [],
                skill_combat: [],
                reactions: [],
                free: []
            },
            exploration: [],
            downtime: []
        };

        // 1. System Actions
        if (game.pf2e?.actions) {
            for (const action of game.pf2e.actions) {
                if (seenSlugs.has(action.slug)) continue;
                seenSlugs.add(action.slug);

                let name = game.i18n.localize(action.name);
                const traits = action.traits instanceof Set ? Array.from(action.traits) : (action.traits || []);
                const skillTrait = traits.find(t => Starfinder2eAdapter.SKILL_TRAITS.includes(t.value || t));

                const glyph = this._getActionGlyph(action.cost || action.actionType);
                const display = this._prepareActionDisplay(name, action.slug, glyph, `skillaction:${action.slug}`);

                let img = (action.img && !display.hasRaIcon && !action.img.includes("mystery-man")) ? action.img : "";
                if (!img && !display.hasRaIcon) img = "icons/svg/d20.svg";

                const variants = (['trip', 'force-open', 'grapple', 'reposition', 'shove', 'administer-first-aid'].includes(action.slug))
                    ? (action.slug === 'administer-first-aid' ? ['STABILIZE', 'STOP BLEEDING'] : (action.slug === 'force-open' ? ['NORMAL', 'MAP -5', 'MAP -10'] : ['NORMAL', 'MAP -4', 'MAP -8']))
                    : [];

                let finalName = display.html;
                if (variants.length > 0) {
                    let buttonsHtml = `<div style="display:flex; gap:3px; flex-wrap:wrap; margin-top:4px;">`;
                    variants.forEach((v, idx) => {
                        buttonsHtml += `
                            <button type="button" 
                                onclick="event.stopPropagation(); StylishAction.useItem('skillaction:${action.slug}:${idx}', event)"
                                style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.2); color:#ccc; border-radius:2px; padding:1px 4px; font-size:0.7em; font-family:'Oswald',sans-serif; cursor:pointer; line-height:1; min-width:24px; text-align:center;"
                                onmouseover="this.style.background='rgba(255,255,255,0.2)'; this.style.color='#fff';"
                                onmouseout="this.style.background='rgba(0,0,0,0.4)'; this.style.color='#ccc';"
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
                    description: await this._prepareTooltip(name, game.i18n.localize(action.description), traits),
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
                    // Fallback para não sumir com ações desconhecidas
                    if (action.actionType === "reaction" || action.actionType === "free") {
                        buckets.encounter.reactions.push(itemData);
                    } else {
                        buckets.encounter.skill_combat.push(itemData);
                    }
                }
            }
        }

        // 2. Actor Actions (Feats/Items)
        const actorItems = [...actor.itemTypes.action, ...actor.itemTypes.feat];
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
            else if (actionType === "reaction" || slugsReactions.includes(slug)) buckets.encounter.reactions.push(itemData);
            else if (actionType === "free" || slugsFreeActions.includes(slug)) buckets.encounter.free.push(itemData);
            else if (actionType === "passive") { /* ignore */ }
            else if (i.type === "action") buckets.encounter.skill_combat.push(itemData);
        }

        // Flatten Buckets into items array with Headers (The "Submenus")
        const items = { encounter: [], exploration: [], downtime: [] };

        // Flatten Encounter
        const encounterLabels = {
            attack: "Attacks & Maneuvers",
            movement: "Basic Movement",
            interact_percept: "Interaction & Perception",
            defense_support: "Defense & Support",
            specialty: "Specialized Actions",
            skill_combat: "Skill Actions (Combat)",
            reactions: "Reactions",
            free: "Free Actions"
        };
        for (const [key, label] of Object.entries(encounterLabels)) {
            if (buckets.encounter[key].length > 0) {
                items.encounter.push({ id: `header-encounter-${key}`, isHeader: true, name: label });
                items.encounter.push(...buckets.encounter[key].sort((a, b) => a.name.localeCompare(b.name)));
            }
        }

        // Add Follow the Expert to Exploration
        const fteName = game.i18n.localize("PF2E.Actions.FollowTheExpert.Title");
        const fteDisplay = this._prepareActionDisplay(fteName, "follow-the-expert", this._getActionGlyph("1"), "skillaction:follow-the-expert");
        items.exploration.unshift({
            id: "skillaction:follow-the-expert",
            name: fteDisplay.html,
            img: "",
            cost: "",
            description: await this._prepareTooltip(fteName, "PF2E.Actions.FollowTheExpert.Description", ["exploration"]),
            tooltipData: {
                traits: ["exploration"],
                description: "PF2E.Actions.FollowTheExpert.Description"
            }
        });

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
            encounter: "Encounter <i class='ra ra-crossed-swords' style='margin-left: 5px;'></i>",
            exploration: "Exploration <i class='ra ra-compass' style='margin-left: 5px;'></i>",
            downtime: "Downtime <i class='ra ra-stopwatch' style='margin-left: 5px;'></i>"
        };

        const tabTooltips = {
            encounter: "Encounter actions are used when time is measured in rounds.",
            exploration: "Continuous activities performed while the party travels or investigates.",
            downtime: "Actions performed during periods of rest, lasting days or weeks."
        };

        return { title: "ACTIONS", theme: "blue", hasTabs: true, hasSubTabs: false, items, tabLabels, tabTooltips };
    }

    /**
     * Replica o comportamento do pf2e-hud: move os Strikes para dentro do menu de Ações.
     * Eles aparecem como a primeira aba/seção do submenu.
     */
    async _getSystemSubMenuData(actor, systemId, menuData) {
        if (systemId === "action") {
            const actionData = await this._getActionData(actor);
            const strikeData = await super._getSystemSubMenuData(actor, "strike", menuData);

            if (!actionData) return strikeData || { title: menuData.label, items: [] };

            if (Array.isArray(actionData.items?.encounter)) {
                // Injeta os Strikes logo após o cabeçalho de Ataques
                let attackIdx = actionData.items.encounter.findIndex(i => i.isHeader && i.name.includes("Attacks"));
                if (attackIdx === -1) attackIdx = 0;

                actionData.items.encounter.splice(attackIdx + 1, 0,
                    ...strikeData.items,
                    { id: "separator-strikes", isHeader: false, name: "---", img: "" } // Separador
                );
            }

            actionData.title = menuData.label;
            return actionData;
        }
        return super._getSystemSubMenuData(actor, systemId, menuData);
    }

    /**
     * Define as categorias padrão do menu de ações para Starfinder 2e.
     * O Strike foi removido do topo (getDefaultLayout) para ficar dentro de 'Action'.
     */
    getDefaultLayout() {
        return [
            {
                systemId: "spell",
                label: "Spells <i class='ra ra-bleeding-eye' style='margin-left: 10px;'></i>",
                icon: "",
                img: "",
                type: "submenu",
                useSidebar: true,
            },
            {
                systemId: "action",
                label: "Actions <i class='ra ra-aware' style='margin-left: 10px;'></i>",
                icon: "",
                img: "",
                type: "submenu",
                useSidebar: true,
            },
            {
                systemId: "feat",
                label: "Feats <i class='ra ra-regeneration' style='margin-left: 10px;'></i>",
                icon: "",
                img: "",
                type: "submenu",
                useSidebar: true,
            },
            {
                systemId: "utility",
                label: "Utility <i class='ra ra-gear-hammer' style='margin-left: 10px;'></i>",
                icon: "",
                img: "",
                type: "submenu",
                useSidebar: true,
            },
            {
                systemId: "inventory",
                label: "Inventory <i class='ra ra-triforce' style='margin-left: 10px;'></i>",
                icon: "",
                img: "",
                type: "submenu",
                useSidebar: true,
            },
        ];
    }

    // Regra SF2e: Stamina absorve dano antes do HP
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

    /**
     * Manipula a execução das novas ações utilitárias.
     */
    async useItem(actor, itemId, event = null) {
        // Normaliza o evento para garantir que as propriedades (ctrl, shift) sejam passadas corretamente
        const e = event || window.event || {};
        const cleanEvent = this._normalizePointerEvent(e);

        // Suporte para Skill Actions do sistema (ex: Trip, Sense Motive)
        if (itemId.startsWith("skillaction:")) {
            const parts = itemId.split(":");
            const slug = parts[1];
            const variantIdx = parts[2];
            const isChat = parts.includes("chat");
            const action = game.pf2e.actions.get(slug);

            if (!action) return;

            // Se o comando for para o chat, enviamos a mensagem rica
            if (isChat) {
                if (typeof action.toMessage === "function") return action.toMessage({ actors: [actor] });
                // Fallback: executa com shift para forçar o card se toMessage não existir
                return action.use({ event: { shiftKey: true }, actors: [actor] });
            }

            const options = { event: cleanEvent, actors: [actor] };
            if (variantIdx !== undefined) options.variant = variantIdx;
            return action.use(options);
        }

        if (itemId.startsWith("sf2e-util:")) {
            const action = itemId.replace("sf2e-util:", "");
            switch (action) {
                case "use-resolve":
                    // Abre a ficha ou dispara o diálogo de repouso se disponível
                    return actor.sheet.render(true);
            }
        }

        // Intercepta cliques em itens do inventário para abrir a ficha (informações) 
        // em vez de abrir o Strike Dialog (para armas) ou usar o item automaticamente.
        const parts = itemId.split("_");
        const realItemId = parts[0];
        const command = parts.includes("chat") ? "chat" : (parts.length > 1 ? parts[1] : null);

        // Se for um clique direto no item (sem comando de ataque/dano) e sem prefixos de sistema
        if (!command && !itemId.includes(":") && !itemId.startsWith("macro-") && !itemId.startsWith("blast_")) {
            let item = actor.items.get(realItemId);
            if (!item) item = this.findSyntheticItem(actor, realItemId);

            if (item) {
                const infoTypes = ["weapon", "armor", "equipment", "consumable", "treasure", "backpack", "ammo", "augmentation", "upgrade"];
                if (infoTypes.includes(item.type)) {
                    return item.sheet.render(true);
                }

                // Lógica principal: Enviar Feats e Actions para o chat como no Token Action HUD
                // Isso renderiza o card rico (action-card.hbs) com a descrição completa.
                if (["feat", "action"].includes(item.type)) {
                    // Atalho: Shift + Clique abre a ficha original do item
                    if (cleanEvent.shiftKey) return item.sheet.render(true);

                    return item.toChat ? item.toChat(e) : item.use({ event: e });
                }
            }
        }

        // Trata o comando de chat para itens (Feats, Actions, Inventory)
        if (command === "chat") {
            const item = actor.items.get(realItemId) || this.findSyntheticItem(actor, realItemId);
            if (item) {
                if (typeof item.toChat === "function") return item.toChat(e);
                return item.use({ event: { shiftKey: true } });
            }
        }

        return super.useItem(actor, itemId, event);
    }

    async _handleItem(actor, itemId, event, context = {}) {
        const item = actor.items.get(itemId) || this.findSyntheticItem(actor, itemId);
        // Garante que gatilhos secundários (como atalhos) também usem o Action Card rico
        if (item && ["feat", "action"].includes(item.type)) {
            if (typeof item.toChat === "function") return item.toChat(event);
            if (typeof item.use === "function") return item.use({ event });
        }
        return super._handleItem(actor, itemId, event, context);
    }
}

Hooks.once("stylish-action-hud.apiReady", api => {
    // Registra o adaptador para o sistema sf2e
    api.registerSystemAdapter("sf2e", Starfinder2eAdapter);

    // Injeta CSS dinâmico para o efeito de troca de ícone ao passar o mouse
    const style = document.createElement("style");
    style.innerHTML = `
        .sf2e-action-item-row:hover .sf2e-base-icon { opacity: 0; }
        .sf2e-action-item-row:hover .sf2e-chat-icon { opacity: 1 !important; }
    `;
    document.head.appendChild(style);

    console.log("SF2E Stylish Action HUD | Adaptador Starfinder 2e inicializado com sucesso.");
});
