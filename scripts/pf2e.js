/* scripts/systems/pf2e.js */
/* cspell:ignore perc spellcasting IBHUD triforce Kineticist Teko altattack altdamage skillaction unequip publicroll WIZA SPELLBOOK tshirt Rollable */

import { BaseSystemAdapter, configProps } from "./base.js";

export class Pf2eAdapter extends BaseSystemAdapter {
	constructor() {
		super();
		this.systemId = "pf2e";
	}

	/* =========================================
	   HUD STATS
	   ========================================= */

	getStats(actor, config) {
		if (!config || config.length === 0) return [];

		return config.map((attr) => {
			if (!attr.path || attr.path.trim() === "") {
				return {
					path: "",
					label: attr.label || "New Attribute",
					value: 3,
					max: 5,
					percent: 60,
					temp: 0,
					tempPercent: 0,
					subtype: "resource",
					...configProps(attr),
				};
			}

			if (attr.path === "combat.initiative") {
				const combatant = game.combat?.combatants?.find(
					(c) => c.actorId === actor.id,
				);
				const initiative = combatant?.initiative;
				const value = Number.isFinite(initiative) ? initiative : "—";
				return {
					path: attr.path,
					label: attr.label,
					value,
					max: 0,
					percent: 100,
					subtype: "resource",
					temp: 0,
					tempPercent: 0,
					...configProps(attr),
				};
			}

			let val = 0,
				max = 0,
				temp = 0;
			let broken = false;
			let label = attr.label;

			// PF2e Perception — Statistic object handled separately
			if (attr.path === "system.attributes.perception.value") {
				const percStat = actor.perception ?? actor.attributes?.perception;
				val = percStat?.mod ?? percStat?.totalModifier ?? percStat?.value ?? 0;
			}
			else if (attr.path.startsWith("items.")) {
				const parts = attr.path.split(".");
				if (parts.length >= 3) {
					const itemId = parts[1];
					const prop = parts[2];
					const item = actor.items.get(itemId);

					if (item) {
						if (label === "NEW" || !label) label = item.name;

						if (prop === "quantity") {
							val = item.quantity;
							max = 0;
						} else if (prop === "uses") {
							const freq = item.system.frequency;
							if (freq) {
								val = freq.value ?? 0;
								max = freq.max ?? 0;
							}
						}
					}
				}
			}
			else if (attr.path.startsWith("spellcasting.")) {
				const parts = attr.path.split(".");
				const entryId = parts[1];
				const entry = actor.spellcasting?.get(entryId);

				if (entry) {
					// Case A: Spell DC (spellcasting.{id}.dc)
					if (parts[2] === "dc") {
						val = entry.statistic?.dc?.value ?? 0;
						max = 0;
					}
					// Case B: Spell Slots (spellcasting.{id}.slots.{slotKey})
					else if (parts.length >= 4 && parts[2] === "slots") {
						const slotKey = parts[3];
						const slotData = entry.system.slots?.[slotKey];
						if (slotData) {
							max = slotData.max ?? 0;
							if (entry.isPrepared && !entry.isFlexible && slotData.prepared) {
								val = slotData.prepared.filter(p => p.id && !p.expended).length;
							} else {
								val = slotData.value ?? 0;
							}
						}
					}
				}
			}
			else if (attr.path.startsWith("system.attributes.speed.otherSpeeds.")) {
				const speedType = attr.path.split(".").pop();
				const otherSpeeds = actor.system.attributes?.speed?.otherSpeeds || [];
				const found = otherSpeeds.find((s) => s.type === speedType);
				val = found?.total ?? found?.value ?? 0;
			}
			else {
				// Get data for the specific property path
				const prop = foundry.utils.getProperty(actor, attr.path);

				if (typeof prop === "number") {
					// 1. Direct numeric value (e.g., attributes.ac.value)
					val = prop;

					// Special case: AC doesn't have a Max, find matching .max if possible
					if (attr.path.endsWith(".value")) {
						const maxPath = attr.path.replace(".value", ".max");
						max = foundry.utils.getProperty(actor, maxPath) ?? 0;
					}
				} else if (typeof prop === "object" && prop !== null) {
					// 2. Resource object (e.g., attributes.hp -> {value, max, temp})
					val = prop.value ?? 0;
					max = prop.max ?? 0;
					temp = prop.temp ?? 0;
				}

				// Special correction: Shield
				// Max might be 0 if shield is missing or broken
				if (attr.path.includes("shield")) {
					// In PF2e, shield data resides in attributes.shield
					if (!actor.attributes.shield) {
						val = 0;
						max = 0;
					} else if (actor.attributes.shield.broken) {
						broken = true;
					}
				}
			}

			// Progress calculation
			let percent = 0;
			if (max > 0) {
				percent = Math.clamp((val / max) * 100, 0, 100);
			} else {
				// Attributes without Max (AC, Qty) show 100% if value exists
				percent = 100;
			}

			// Temp HP percent
			let tempPercent = 0;
			if (max > 0 && temp > 0) {
				tempPercent = Math.clamp((temp / max) * 100, 0, 100);
			}

			return {
				path: attr.path,
				label: attr.label,
				value: val,
				max: max,
				percent: percent,
				subtype: "resource",
				temp: temp,
				tempPercent: tempPercent,
				broken: broken,
				...configProps(attr),
			};
		});
	}

	getDefaultAttributes() {
		return [
			{
				path: "system.attributes.hp",
				label: "HP",
				color: "#e61c34",
				icon: "material-symbols-outlined icon-google-hp"
			},
			{
				path: "system.attributes.ac.value",
				label: "AC",
				color: "#ffffff",
				style: "badge",
				icon: "material-symbols-outlined icon-google-ac",
				textColor: "#000000",
				textStrokeColor: "#ffffff",
				badgeScale: 1.0,
			},
			{
				path: "system.attributes.speed.total",
				label: "Speed",
				color: "#ffffff",
				style: "badge",
				icon: "material-symbols-outlined icon-google-sp",
				textColor: "#000000",
				textStrokeColor: "#ffffff",
				badgeScale: 1.0,
			},
			{
				path: "system.resources.heroPoints",
				label: "Hero",
				color: "#ffffff",
				style: "badge",
				icon: "material-symbols-outlined icon-menu-feat",
				textColor: "#000000",
				textStrokeColor: "#ffffff",
				badgeScale: 1.0,
			},
		];
	}

	getTrackableAttributes(actor) {
		const stats = [];
		const s = actor.system; // Shorthand

		// 1. [Attributes] 핵심 스탯
		stats.push({ path: "system.attributes.hp", label: "Hit Points (HP)" });
		stats.push({
			path: "system.attributes.ac.value",
			label: "Armor Class (AC)",
		});

		if (actor.attributes.shield) {
			stats.push({ path: "system.attributes.shield.hp", label: "Shield HP" });
		}

		stats.push({
			path: "system.attributes.perception.value",
			label: "Perception",
		});
		stats.push({ path: "system.attributes.classDC.value", label: "Class DC" });

		// 2. [Core Stats] Speed, Level
		stats.push({
			path: "system.attributes.speed.total",
			label: "Speed",
			style: "number",
		});

		// 2-B. [Other Speeds] Fly, Swim, Burrow, Climb 등
		if (s.attributes?.speed?.otherSpeeds) {
			s.attributes.speed.otherSpeeds.forEach((spd) => {
				if (!spd.type) return;
				const typeLabel = spd.type.charAt(0).toUpperCase() + spd.type.slice(1);
				stats.push({
					path: `system.attributes.speed.otherSpeeds.${spd.type}`,
					label: `Speed: ${typeLabel}`,
					style: "number",
				});
			});
		}

		stats.push({
			path: "system.details.level.value",
			label: "Level",
			style: "number",
		});

		// 3. [Resources] 자원
		if (s.resources) {
			if (s.resources.focus)
				stats.push({
					path: "system.resources.focus",
					label: "Focus Points",
					style: "dots",
				});
			const heroPoints = s.resources.heroPoints ?? s.resources.hero;
			if (heroPoints)
				stats.push({
					path: "system.resources.heroPoints",
					label: "Hero Points",
					style: "dots",
				});
			if (s.resources.crafting)
				stats.push({
					path: "system.resources.crafting.infused",
					label: "Infused Reagents",
					style: "dots",
				});
		}

		// 3. [Saves] 내성 굴림
		if (s.saves) {
			stats.push({
				path: "system.saves.fortitude.value",
				label: "Save: Fortitude",
			});
			stats.push({ path: "system.saves.reflex.value", label: "Save: Reflex" });
			stats.push({ path: "system.saves.will.value", label: "Save: Will" });
		}

		// 4. [Skills] Process all available skills
		if (s.skills) {
			// Sort alphabetically
			const skillKeys = Object.keys(s.skills).sort();
			skillKeys.forEach((key) => {
				const skill = s.skills[key];
				// label이 있는 경우만 (lore 스킬 등)
				if (skill.label) {
					stats.push({
						path: `system.skills.${key}.value`,
						label: `Skill: ${skill.label}`,
					});
				}
			});
		}

		if (actor.items) {
			actor.items.forEach((i) => {
				if (
					(i.type === "consumable" ||
						i.type === "equipment" ||
						i.type === "treasure") &&
					i.quantity > 0
				) {
					stats.push({
						path: `items.${i.id}.quantity`,
						label: `Qty: ${i.name}`,
					});
				}
			});
		}

		if (actor.spellcasting) {
			for (const entry of actor.spellcasting.contents) {
				if (!entry.isSpontaneous && !entry.isInnate && !entry.isPrepared) continue;

				const entryName = entry.name || "Spells";
				const shortName = entryName.length > 10 ? entryName.substring(0, 8) + ".." : entryName;

				// ★ Spell DC 추가
				const dc = entry.statistic?.dc?.value;
				if (dc) {
					stats.push({
						path: `spellcasting.${entry.id}.dc`,
						label: `${shortName} DC`,
						style: "badge",
						icon: "material-symbols-outlined auto_awesome", // Using auto_awesome for spell menu
						color: "#9966ff",
						textColor: "#ffffff",
						textStrokeColor: "#000000",
						badgeScale: 1.0,
					});
				}

				for (let rank = 1; rank <= 10; rank++) {
					const slotKey = `slot${rank}`;
					const slotData = entry.system.slots?.[slotKey];

					if (slotData && slotData.max > 0) {
						stats.push({
							path: `spellcasting.${entry.id}.slots.${slotKey}`,
							label: `${shortName} R${rank}`,
							style: "dots",
						});
					}
				}
			}
		}

		return stats;
	}

	/* =========================================
	   STAT ROLL (PF2e)
	   ========================================= */

	rollStat(actor, path, event) {
		// system.saves.{key}.value → actor.saves[key].roll()
		const saveMatch = path.match(/^system\.saves\.(\w+)\.value$/);
		if (saveMatch) {
			const saveKey = saveMatch[1];
			return actor.saves?.[saveKey]?.roll({ event }) ?? null;
		}

		// system.skills.{key}.value → actor.skills[key].roll()
		const skillMatch = path.match(/^system\.skills\.(\w+)\.value$/);
		if (skillMatch) {
			const skillKey = skillMatch[1];
			return actor.skills?.[skillKey]?.roll({ event }) ?? null;
		}

		// system.attributes.perception.value → actor.perception.roll()
		if (path === "system.attributes.perception.value") {
			return actor.perception?.roll({ event }) ?? null;
		}

		// combat.initiative → actor.initiative.roll()
		if (path === "combat.initiative") {
			return actor.initiative?.roll({ event }) ?? null;
		}

		return null;
	}

	isStatRollable(path) {
		if (/^system\.saves\.\w+\.value$/.test(path)) return true;
		if (/^system\.skills\.\w+\.value$/.test(path)) return true;
		if (path === "system.attributes.perception.value") return true;
		if (path === "combat.initiative") return true;
		return false;
	}

	/* =========================================
	   ACTION MENU (PF2e Logic)
	   ========================================= */

	getDefaultLayout() {
		return [
			{
				systemId: "strike",
				label: `${game.i18n.localize("IBHUD.Category.Strike")} <span class="material-symbols-outlined" style="margin-left: 10px;">swords</span>`,
				icon: "",
				type: "submenu",
				useSidebar: false,
			},
			{
				systemId: "spell",
				label: `${game.i18n.localize("IBHUD.Category.Spells")} <span class="material-symbols-outlined" style="margin-left: 10px;">auto_awesome</span>`,
				icon: "",
				type: "submenu",
				useSidebar: true,
			},
			{
				systemId: "action",
				label: `${game.i18n.localize("IBHUD.Category.Actions")} <span class="material-symbols-outlined" style="margin-left: 10px;">engineering</span>`,
				icon: "",
				type: "submenu",
				useSidebar: true,
			},
			{
				systemId: "feat",
				label: `${game.i18n.localize("IBHUD.Category.Feats")} <span class="material-symbols-outlined" style="margin-left: 10px;">military_tech</span>`,
				icon: "",
				type: "submenu",
				useSidebar: true,
			},
			{
				systemId: "utility",
				label: `${game.i18n.localize("IBHUD.Category.Utility")} <span class="material-symbols-outlined" style="margin-left: 10px;">build</span>`,
				icon: "",
				type: "submenu",
				useSidebar: true,
			},
			{
				systemId: "inventory",
				label: `${game.i18n.localize("IBHUD.Category.Inventory")} <span class="material-symbols-outlined" style="margin-left: 10px;">inventory_2</span>`,
				icon: "",
				type: "submenu",
				useSidebar: true,
			},
		];
	}

	async _getSystemSubMenuData(actor, systemId, menuData) {
		switch (systemId) {
			case "strike":
				return { ...this._getStrikeData(actor), title: menuData.label };
			case "spell":
				return { ...(await this._getSpellData(actor)), title: menuData.label };
			case "action":
				return { ...this._getActionData(actor), title: menuData.label };
			case "feat":
				return { ...(await this._getFeatData(actor)), title: menuData.label };
			case "inventory":
				return { ...this._getInventoryData(actor), title: menuData.label };
			case "utility":
				return { ...this._getUtilityData(actor), title: menuData.label };
			default:
				return { title: menuData.label, items: [] };
		}
	}

	/* -----------------------------------------
	   1. STRIKE (Attacks)
	   ----------------------------------------- */
	_getStrikeData(actor) {
		const allActions = actor.system.actions || [];
		// Includes weapons not in hand (sheathed/dropped) to allow the Draw action in the HUD
		const strikes = allActions.filter((a) =>
			!a.item || a.item.system?.equipped?.carryType !== "stowed"
		);

		const items = [];

		// [A] General Strikes
		strikes.forEach((s) => {
			items.push(this._createStrikeItem(s));
		});

		// [B] Kineticist Elemental Blast
		if (game.pf2e?.ElementalBlast) {
			try {
				const elementalBlast = new game.pf2e.ElementalBlast(actor);
				if (elementalBlast.item && elementalBlast.configs?.length > 0) {
					elementalBlast.configs.forEach((config) => {
						const blastItem = this._createElementalBlastItem(elementalBlast, config);
						if (blastItem) items.push(blastItem);
					});
				}
			} catch (e) {
				// Not a Kineticist or error - silently ignore
			}
		}

		return { title: "STRIKES", theme: "red", hasTabs: false, items: items };
	}

	_getCompatibleAmmo(weapon) {
		const actor = weapon.actor;
		if (!actor) return [];
		return [
			...(actor.itemTypes?.ammo || []).filter(i => !i.isStowed),
			...(actor.itemTypes?.weapon || []).filter(w => w.system?.usage?.canBeAmmo),
		].filter(a => typeof a.isAmmoFor === 'function' && a.isAmmoFor(weapon));
	}

	_getLoadedAmmoInfo(weapon) {
		const capacity = weapon.system.ammo?.capacity ?? 0;
		if (!capacity || !weapon.subitems) return { loaded: 0, capacity: 0, remaining: 0 };
		const loadedItems = [...weapon.subitems].filter(i =>
			typeof i.isOfType === 'function' &&
			(i.isOfType("ammo") || (i.isOfType("weapon") && typeof i.isAmmoFor === 'function' && i.isAmmoFor(weapon)))
		);
		const validLoaded = loadedItems.filter(a =>
			!(a.isOfType("ammo") && a.isMagazine && (a.system?.uses?.value ?? 0) === 0)
		);
		const numLoaded = validLoaded.reduce((sum, l) => sum + (l.quantity ?? 1), 0);
		return { loaded: numLoaded, capacity, remaining: Math.max(0, capacity - numLoaded) };
	}

	_buildAmmoRowHtml(strike) {
		const weapon = strike.item;
		if (!weapon?.system?.ammo) return "";
		if (weapon.system.ammo.builtIn) return "";

		const ammo = weapon.ammo;
		const weaponId = weapon.id;

		if (!ammo) {
			return `
				<div style="display:flex; align-items:center; gap:3px; margin-top:2px;">
					<span style="
						background: rgba(80, 30, 30, 0.8);
						border: 1px solid #a44;
						border-radius: 3px;
						padding: 1px 6px;
						font-size: 0.8em;
						color: #fa0;
						line-height: 1.2;
					">⚠ No ammo</span>
					<button type="button"
						onclick="event.stopPropagation(); StylishAction.useItem('ammo:${weaponId}:dropdown', event)"
						title="Select Ammo"
						style="background: rgba(40, 60, 40, 0.8); border: 1px solid #585; color: #ada; border-radius: 3px; padding: 1px 5px; font-size: 0.8em; cursor: pointer; line-height: 1.2;"
						onmouseover="this.style.background='#585'; this.style.color='#fff';"
						onmouseout="this.style.background='rgba(40, 60, 40, 0.8)'; this.style.color='#ada';">
						▼
					</button>
				</div>`;
		}

		const count = ammo.isMagazine ? (ammo.system.uses?.value ?? 0) : (ammo.quantity ?? 0);
		const isLow = count <= 3 && count > 0;
		const isEmpty = count === 0;
		const badgeBg = isEmpty ? "rgba(80, 30, 30, 0.8)" : "rgba(40, 60, 40, 0.8)";
		const badgeBorder = isEmpty ? "#a44" : "#585";
		const countColor = isEmpty ? "#f66" : isLow ? "#fa0" : "#ada";
		const ammoImg = ammo.img ? `<img src="${ammo.img}" style="width:14px; height:14px; border:0; border-radius:2px; margin-right:3px; vertical-align:middle;" />` : "";

		return `
			<div style="display:flex; align-items:center; gap:3px; margin-top:2px;">
				<span style="
					display:inline-flex; align-items:center;
					background: ${badgeBg};
					border: 1px solid ${badgeBorder};
					border-radius: 3px;
					padding: 1px 6px;
					font-size: 0.8em;
					color: #ccc;
					line-height: 1.2;
					max-width: 130px;
					overflow: hidden;
				">
					${ammoImg}<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80px;">${ammo.name}</span>
					<span style="font-family:'Teko',sans-serif; font-size:1.1em; color:${countColor}; margin-left:4px;">x${count}</span>
				</span>
				<button type="button"
					onclick="event.stopPropagation(); StylishAction.useItem('ammo:${weaponId}:dropdown', event)"
					title="Select Ammo"
					style="background: rgba(40, 60, 40, 0.8); border: 1px solid #585; color: #ada; border-radius: 3px; padding: 1px 5px; font-size: 0.8em; cursor: pointer; line-height: 1.2;"
					onmouseover="this.style.background='#585'; this.style.color='#fff';"
					onmouseout="this.style.background='rgba(40, 60, 40, 0.8)'; this.style.color='#ada';">
					▼
				</button>
				<button type="button"
					onclick="event.stopPropagation(); StylishAction.useItem('ammo:${weaponId}:minus', event)"
					title="Decrease Ammo"
					style="background: rgba(50, 50, 50, 0.8); border: 1px solid #666; color: #eee; border-radius: 3px; padding: 1px 5px; font-size: 0.8em; cursor: pointer; line-height: 1.2;"
					onmouseover="this.style.background='#eee'; this.style.color='#000';"
					onmouseout="this.style.background='rgba(50, 50, 50, 0.8)'; this.style.color='#eee';">
					−
				</button>
				<button type="button"
					onclick="event.stopPropagation(); StylishAction.useItem('ammo:${weaponId}:plus', event)"
					title="Increase Ammo"
					style="background: rgba(50, 50, 50, 0.8); border: 1px solid #666; color: #eee; border-radius: 3px; padding: 1px 5px; font-size: 0.8em; cursor: pointer; line-height: 1.2;"
					onmouseover="this.style.background='#eee'; this.style.color='#000';"
					onmouseout="this.style.background='rgba(50, 50, 50, 0.8)'; this.style.color='#eee';">
					+
				</button>
			</div>`;
	}

	_createStrikeItem(s) {
		// Defines if the item is ready for immediate use (unarmed attacks or items in hands)
		const isUnarmed = s.item?.type === "unarmed" ||
						  s.item?.slug === "unarmed" ||
						  s.item?.system?.category === "unarmed" || 
						  s.traits?.some(t => (t.value || t) === "unarmed");
		const isHeld = s.item?.system?.equipped?.carryType === "held";
		const isReady = isHeld || isUnarmed;

		// [A-0] Build ammunition interface
		const ammoHtml = this._buildAmmoRowHtml(s);

		// Traits da Arma
		// Weapon Traits
		let traitsHtml = "";
		if (s.traits?.length > 0) {
			traitsHtml = `<div style="display:flex; gap:2px; flex-wrap:wrap; margin-top:2px;">`;
			s.traits.forEach(t => {
				traitsHtml += `<span style="font-size:0.65em; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:2px; padding:0 3px; color:#999; line-height:1.2;" title="${t.description || ''}">${t.label}</span>`;
			});
			traitsHtml += `</div>`;
		}

		// Auxiliary Actions (Grip, Sheathe, etc)
		let auxHtml = "";
		if (s.auxiliaryActions?.length > 0) {
			auxHtml = `<div style="display:flex; gap:3px; flex-wrap:wrap; margin-top:2px;">`;
			s.auxiliaryActions.forEach((aux, idx) => {
				const glyph = this._getActionGlyph(aux.actionCost || 1);
				auxHtml += `
					<button type="button"
						onclick="event.stopPropagation(); StylishAction.useItem('${s.item.id}_auxiliary_${idx}')"
						title="${aux.label}"
						style="background:rgba(40, 60, 80, 0.6); border:1px solid #468; color:#adf; border-radius:3px; padding:1px 5px; font-size:0.75em; cursor:pointer; line-height:1.1; display:flex; align-items:center; gap:2px;"
						onmouseover="this.style.background='#468'; this.style.color='#fff';"
						onmouseout="this.style.background='rgba(40, 60, 80, 0.6)'; this.style.color='#adf';">
						${glyph} <span style="font-family:'Oswald',sans-serif;">${aux.label}</span>
					</button>`;
			});
			auxHtml += `</div>`;
		}

		// [A] Generate primary action buttons
		let buttonsHtml = "";
		if (isReady) {
			buttonsHtml = `<div style="display:flex; gap:3px; flex-wrap:wrap; margin-top:2px;">`;

			// 1. Attack Variants
			s.variants.forEach((v, idx) => {
				const opacity = idx === 0 ? "1.0" : idx === 1 ? "0.8" : "0.6";

				buttonsHtml += `
						<button 
							type="button"
							class="pf2e-map-btn"
							onclick="event.stopPropagation(); StylishAction.useItem('${s.item.id}_attack_${idx}')"
							title="${idx === 0 ? "1st Attack" : idx === 1 ? "2nd Attack (MAP)" : "3rd Attack (MAP)"}"
							style="
								background: rgba(50, 50, 50, ${opacity}); 
								border: 1px solid #666; 
								color: #eee; 
								border-radius: 3px; 
								padding: 1px 6px; 
								font-size: 0.85em; 
								font-family: 'Oswald', sans-serif;
								cursor: pointer;
								line-height: 1.2;
								min-width: 30px;
								text-align: center;
							"
							onmouseover="this.style.background='#eee'; this.style.color='#000';"
							onmouseout="this.style.background='rgba(50, 50, 50, ${opacity})'; this.style.color='#eee';"
						>
							${v.label}
						</button>
					`;
			});

			// 2. Damage Buttons
			buttonsHtml += `
					<button
						type="button"
						class="pf2e-dmg-btn"
						onclick="event.stopPropagation(); StylishAction.useItem('${s.item.id}_damage')"
						title="Click: Damage / Ctrl+Click: Critical"
						style="
							background: rgba(100, 20, 20, 0.8); 
							border: 1px solid #d44; 
							color: #faa; 
							border-radius: 3px; 
							padding: 1px 6px; 
							font-size: 0.85em; 
							cursor: pointer;
							line-height: 1.2;
							margin-left: 2px;
						"
						onmouseover="this.style.background='#d44'; this.style.color='#fff';"
						onmouseout="this.style.background='rgba(100, 20, 20, 0.8)'; this.style.color='#faa';"
					>
						<span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/jolt.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/jolt.svg'); width: 12px; height: 12px;"></span>
					</button>
				</div>`;
		}

		// [A-2] altUsages가 있는 경우 (예: area-fire 무기에 일반 strike 대안이 있는 경우)
		let altButtonsHtml = "";
		if (s.altUsages?.length > 0) {
			s.altUsages.forEach((alt, altIdx) => {
				if (!alt.variants?.length) return;
				altButtonsHtml += `<div style="display:flex; gap:3px; flex-wrap:wrap; margin-top:2px;">`;
				alt.variants.forEach((v, idx) => {
					const opacity = idx === 0 ? "1.0" : idx === 1 ? "0.8" : "0.6";
					altButtonsHtml += `
						<button type="button" class="pf2e-map-btn"
							onclick="event.stopPropagation(); StylishAction.useItem('${s.item.id}_altattack_${altIdx}_${idx}')"
							title="${idx === 0 ? "1st Attack" : idx === 1 ? "2nd Attack (MAP)" : "3rd Attack (MAP)"}"
							style="background: rgba(50, 50, 50, ${opacity}); border: 1px solid #666; color: #eee; 
								border-radius: 3px; padding: 1px 6px; font-size: 0.85em; font-family: 'Oswald', sans-serif;
								cursor: pointer; line-height: 1.2; min-width: 30px; text-align: center;"
							onmouseover="this.style.background='#eee'; this.style.color='#000';"
							onmouseout="this.style.background='rgba(50, 50, 50, ${opacity})'; this.style.color='#eee';">
							${v.label}
						</button>`;
				});
				altButtonsHtml += `
					<button type="button" class="pf2e-dmg-btn"
						onclick="event.stopPropagation(); StylishAction.useItem('${s.item.id}_altdamage_${altIdx}')"
						title="Click: Damage / Ctrl+Click: Critical"
						style="background: rgba(100, 20, 20, 0.8); border: 1px solid #d44; color: #faa; 
							border-radius: 3px; padding: 1px 6px; font-size: 0.85em; cursor: pointer;
							line-height: 1.2; margin-left: 2px;"
						onmouseover="this.style.background='#d44'; this.style.color='#fff';"
						onmouseout="this.style.background='rgba(100, 20, 20, 0.8)'; this.style.color='#faa';">
					<span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/jolt.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/jolt.svg'); width: 12px; height: 12px;"></span>
					</button>
				</div>`;
			});
		}

		// Set visual state for unequipped items
		const mainOpacity = isReady ? "1.0" : "0.55";
		const unequippedLabel = !isReady ? `<span style="font-size:0.8em; color:#aaa; font-style:italic; margin-left:5px;">(${game.i18n.localize("IBHUD.Pf2e.ActionUnequipped") || "Unequipped"})</span>` : "";

		// [B] Two-tier layout: Name on top, buttons below
		const layoutHtml = `
                <div style="display:flex; flex-direction:column; align-items:flex-start; justify-content:center; opacity:${mainOpacity};">
                    <span style="font-size:1.05em; font-weight:bold; color:#fff; line-height:1.2; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">
                        ${s.label}
						${unequippedLabel}
                    </span>
					${traitsHtml}
                    ${ammoHtml}
                    ${buttonsHtml}
					${auxHtml}
                    ${altButtonsHtml}
                </div>
            `;

		return {
			id: s.item.id,
			name: layoutHtml,
			img: s.imageUrl || s.item?.img || "icons/svg/d20.svg",
			cost: "",
			description: s.description || s.damageLabel || "Strike",
			_isUnarmed: isUnarmed, // Adiciona esta propriedade
		};
	}

	_createElementalBlastItem(elementalBlast, config) {
		const element = config.element;
		const damageTypes = config.damageTypes || [];
		const label = `Elemental Blast (${element})`;
		const img = elementalBlast.item?.img || "icons/svg/fire.svg";

		let buttonsHtml = `<div style="display:flex; gap:3px; flex-wrap:wrap; margin-top:2px;">`;

		const blastId = `blast_${element}_${damageTypes[0]?.value || "untyped"}`;

		const maps = config.maps?.melee ?? config.maps?.ranged ?? null;

		[0, 1, 2].forEach((idx) => {
			const opacity = idx === 0 ? "1.0" : idx === 1 ? "0.8" : "0.6";
			const mapLabel = maps
				? (idx === 0 ? maps.map0 : idx === 1 ? maps.map1 : maps.map2)
				: (idx === 0 ? "+0" : idx === 1 ? "-4" : "-8");
			buttonsHtml += `
				<button type="button" class="pf2e-map-btn"
					onclick="event.stopPropagation(); StylishAction.useItem('${blastId}_attack_${idx}')"
					title="${idx === 0 ? "1st Attack" : idx === 1 ? "2nd Attack (MAP)" : "3rd Attack (MAP)"}"
					style="background: rgba(50, 50, 50, ${opacity}); border: 1px solid #666; color: #eee; 
						border-radius: 3px; padding: 1px 6px; font-size: 0.85em; font-family: 'Oswald', sans-serif;
						cursor: pointer; line-height: 1.2; min-width: 30px; text-align: center;"
					onmouseover="this.style.background='#eee'; this.style.color='#000';"
					onmouseout="this.style.background='rgba(50, 50, 50, ${opacity})'; this.style.color='#eee';">
					${mapLabel}
				</button>`;
		});

		buttonsHtml += `
			<button type="button" class="pf2e-dmg-btn"
				onclick="event.stopPropagation(); StylishAction.useItem('${blastId}_damage')"
				title="Click: Damage / Ctrl+Click: Critical"
				style="background: rgba(100, 20, 20, 0.8); border: 1px solid #d44; color: #faa; 
					border-radius: 3px; padding: 1px 6px; font-size: 0.85em; cursor: pointer;
					line-height: 1.2; margin-left: 2px;"
				onmouseover="this.style.background='#d44'; this.style.color='#fff';"
				onmouseout="this.style.background='rgba(100, 20, 20, 0.8)'; this.style.color='#faa';">
				<span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/jolt.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/jolt.svg'); width: 12px; height: 12px;"></span>
			</button>
		</div>`;

		const layoutHtml = `
			<div style="display:flex; flex-direction:column; align-items:flex-start; justify-content:center;">
				<span style="font-size:1.05em; font-weight:bold; color:#fff; line-height:1.2;">${label}</span>
				${buttonsHtml}
			</div>`;

		return {
			id: blastId,
			name: layoutHtml,
			img: img,
			cost: "",
			description: `${element} Elemental Blast`,
			isElementalBlast: true,
			blastConfig: config,
		};
	}

	_getStrikeButtonsForPopup(strike) {
		let html = `<div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:center;">`;

		// 1. Attack Buttons
		strike.variants.forEach((v, idx) => {
			const opacity = idx === 0 ? "1.0" : idx === 1 ? "0.8" : "0.6";

			// Remove onclick, use data attributes
			html += `
                <button 
                    type="button"
                    class="pf2e-map-btn"
                    data-action="clickStrike" 
                    data-command="attack"
                    data-item-id="${strike.item.id}"
                    data-variant-index="${idx}"
                    title="${idx === 0 ? "1st Attack" : idx === 1 ? "2nd Attack (MAP)" : "3rd Attack (MAP)"}"
                    style="
                        background: rgba(50, 50, 50, ${opacity}); 
                        border: 1px solid #888; 
                        background: rgba(120, 46, 156, ${opacity}); 
                        border: 1px solid rgba(233, 15, 222, 0.3); 
                        color: #fff; 
                        border-radius: 4px; 
                        padding: 5px 12px; 
                        font-size: 1.1em; 
                        font-family: 'Oswald', sans-serif;
                        cursor: pointer;
                        min-width: 40px;
                        text-align: center;
                    "
                >
                    ${v.label}
                </button>
            `;
		});

		// 2. Damage Button
		html += `
            <button 
                type="button"
                class="pf2e-dmg-btn"
                data-action="clickStrike"
                data-command="damage"
                data-item-id="${strike.item.id}"
                title="Click: Damage / Ctrl+Click: Critical"
                style="
                    background: rgba(150, 20, 20, 0.8); 
                    background: rgba(200, 30, 30, 0.8); 
                    border: 1px solid #f55; 
                    color: #fee; 
                    color: #fff; 
                    border-radius: 4px; 
                    padding: 5px 12px; 
                    font-size: 1.1em; 
                    cursor: pointer;
                    margin-left: 5px;
                "
            >
                <span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/jolt.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/jolt.svg'); width: 1.2em; height: 1.2em; background-color: currentColor; display: inline-block; vertical-align: middle;"></span>
            </button>
        </div>`;

		return html;
	}

	/* -----------------------------------------
	   2. SPELLS
	   ----------------------------------------- */
	async _getSpellData(actor) {
		const spells = {};
		const primaryLabels = {};
		const primaryTooltips = {};
		const subLabels = {};

		const focusPool = actor.system.resources?.focus || { value: 0, max: 0 };

		if (actor.spellcasting) {
			for (const entry of actor.spellcasting.contents) {
				const prepType = entry.system?.prepared?.value;
				if (prepType === "items" || prepType === "charge") continue;
				if (entry.isEphemeral) continue;

				const entryId = entry.id;

				const dc = entry.statistic?.dc?.value ?? null;
				const tradition = entry.tradition ?? entry.system?.tradition?.value ?? null;
				const shortName = this._getShortName(entry.name);

				let labelHtml = shortName;
				if (dc) {
					labelHtml = `${shortName} <span class="ib-dc-badge">DC ${dc}</span> <i class='ra ra-crystal-ball' style='margin-left: 8px;'></i>`;
				}

				primaryLabels[entryId] = labelHtml;
				primaryTooltips[entryId] = dc
					? `${entry.name} (DC ${dc}${tradition ? `, ${tradition}` : ""})`
					: entry.name;

				spells[entryId] = {};
				subLabels[entryId] = {};

				try {
					const sheetData = await entry.getSheetData();

					const isFocusEntry = sheetData.isFocusPool === true;
					const isPrepared = sheetData.isPrepared === true;
					const isSpontaneous = sheetData.isSpontaneous === true;
					const isInnate = sheetData.isInnate === true;

					if (isFocusEntry) {
						const focusMax = focusPool.cap ?? focusPool.max ?? 0;
						const focusValue = focusPool.value ?? 0;
						const statusClass = focusValue > 0 ? "" : "empty";

						const allFocusSpells = [];
						for (const group of sheetData.groups) {
							for (const activeSpell of group.active) {
								if (!activeSpell || !activeSpell.spell) continue;

								const spell = activeSpell.spell;
								const spellItem = this._makeSpellItem(spell, false);
								spellItem.isSingleUse = focusMax === 1;
								if (focusValue <= 0) spellItem.isExhausted = true;

								allFocusSpells.push(spellItem);
							}
						}

						if (allFocusSpells.length > 0) {
							allFocusSpells.sort((a, b) => a.name.localeCompare(b.name));
							spells[entryId]["focus"] = allFocusSpells;
							subLabels[entryId]["focus"] = `F <span class="ib-slot-text ${statusClass}">(${focusValue}/${focusMax})</span>`;
						}
					} else {
						for (const group of sheetData.groups) {
							const rankSpells = [];
							const groupId = group.id;
							const rank = groupId === "cantrips" ? 0 : Number(groupId);

							let slotLabel = rank === 0 ? "C" : `${rank}`;

							if (isPrepared && rank > 0) {
								const totalSlots = group.active?.length ?? 0;
								const usedSlots = group.active?.filter(a => a?.expended).length ?? 0;
								const remainingSlots = totalSlots - usedSlots;
								const statusClass = remainingSlots > 0 ? "" : "empty";
								slotLabel = `${rank} <span class="ib-slot-text ${statusClass}">(${remainingSlots}/${totalSlots})</span>`;
							} else if (isSpontaneous && group.uses && group.uses.max > 0 && rank > 0) {
								const usesValue = group.uses.value ?? 0;
								const statusClass = usesValue > 0 ? "" : "empty";
								slotLabel = `${rank} <span class="ib-slot-text ${statusClass}">(${usesValue}/${group.uses.max})</span>`;
							}

							for (let slotIndex = 0; slotIndex < group.active.length; slotIndex++) {
								const activeSpell = group.active[slotIndex];
								if (!activeSpell || !activeSpell.spell) continue;

								const spell = activeSpell.spell;
								const isExpended = activeSpell.expended === true;
								const isVirtual = activeSpell.virtual === true;
								const isSignature = activeSpell.signature === true;

								let spellItem;

								if (isPrepared && rank > 0) {
									const uniqueId = `restore:${entryId}:${rank}:${slotIndex}:${spell.id}`;
									spellItem = this._makeSpellItem(spell, isExpended);
									spellItem.id = uniqueId;
									spellItem.isSingleUse = true;
								} else if (isSpontaneous && rank > 0) {
									const uniqueId = `spontaneous:${entryId}:${rank}:${spell.id}`;
									spellItem = this._makeSpellItem(spell, isExpended);
									spellItem.id = uniqueId;
									if (group.uses) {
										spellItem.isSingleUse = group.uses.max === 1;
									}
								} else {
									spellItem = this._makeSpellItem(spell, isExpended);

									if (isInnate) {
										const freq = spell.system?.frequency;
										if (freq && freq.max > 0 && freq.max - (freq.value || 0) <= 0) {
											spellItem.isExhausted = true;
										}
									}
								}

								// ★ Signature/Heightened 표시
								spellItem.isVirtual = isVirtual;
								spellItem.isSignature = isSignature;

								rankSpells.push(spellItem);
							}

							if (rankSpells.length > 0) {
								// Native spells first, heightened/virtual below
								rankSpells.sort((a, b) => {
									if (a.isVirtual !== b.isVirtual) return a.isVirtual ? 1 : -1;
									return a.name.localeCompare(b.name);
								});
								spells[entryId][rank] = rankSpells;
								subLabels[entryId][rank] = slotLabel;
							}
						}
					}
				} catch (err) {
					console.warn(`StylishHUD | Failed to get spell data for entry ${entry.name}:`, err);
				}
			}
		}

		return {
			title: "SPELLBOOK",
			theme: "blue",
			hasTabs: true,
			hasSubTabs: true,
			items: spells,
			tabLabels: primaryLabels,
			tabTooltips: primaryTooltips,
			subTabLabels: subLabels,
		};
	}

	/**
	 * Smart Initial Generator
	 * "Arcane Spontaneous" -> "ARC S"
	 * "Wizard" -> "WIZ"
	 */
	_getShortName(name) {
		if (!name) return "???";
		const cleanName = name.trim();

		// Keep short names
		if (cleanName.length <= 3) return cleanName.toUpperCase();

		const words = cleanName.split(" ");

		// Single word: use first 3-4 chars
		if (words.length === 1) {
			return cleanName.substring(0, 4).toUpperCase(); // WIZARD -> WIZA
		}

		// Multiple words: (First 3) + (Second 1)
		// Arcane Spontaneous -> ARC S
		// Divine Innate -> DIV I
		const first = words[0].substring(0, 3);
		const second = words[1].substring(0, 1);

		return `${first} ${second}`.toUpperCase();
	}

	/**
	 * Helper: Create spell item object
	 */
	_makeSpellItem(spell, isExhausted) {
		const timeValue = spell.system.time?.value;
		const costGlyph = this._getActionGlyph(timeValue);
		const img = spell.img || "icons/svg/magic.svg";
		let extraInfo = "";
		const entryId = spell.system.location?.value;
		const entry = spell.actor?.spellcasting?.get(entryId);


		let isSingleUse = false;

		if (entry && entry.isInnate) {
			const freq = spell.system.frequency;
			if (freq && freq.max > 0) {
				const remaining = freq.max - (freq.value || 0);
				const color = isExhausted ? "#f55" : "#888";
				extraInfo = `<span style="font-size:0.8em; color:${color}; margin-left:4px;">(${remaining})</span>`;

				if (freq.max === 1) isSingleUse = true;
			}
		}

		return {
			id: spell.id,
			name: spell.name,
			img: img,
			cost: `
                <div style="display:flex; align-items:center;">
                    ${costGlyph}
                    ${extraInfo}
                </div>
            `,
			description: spell.system.description?.value || "",
			isExhausted: isExhausted,
			isSingleUse: isSingleUse,
		};
	}

	/**
	 * Helper: Push spell to target list
	 */
	_pushSpell(targetList, spell, { cost, isExhausted, sourceInfo }) {
		const rank = spell.isCantrip
			? 0
			: (spell.rank ?? spell.system.level?.value ?? 1);
		if (!targetList[rank]) targetList[rank] = [];

		// 우측에 표시할 HTML 조합
		// 상단: 액션 아이콘 (1, 2, 3)
		// 하단: 출처 태그 (Wizard, Sorcerer (3/4))
		const finalCost = `
            <div style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center; line-height:1.1;">
                <div>${cost}</div>
                <div style="font-size:0.75em; color:#aaa; font-family:'Oswald', sans-serif; white-space:nowrap;">
                    ${sourceInfo || ""}
                </div>
            </div>
        `;

		targetList[rank].push({
			id: spell.id,
			name: spell.name,
			img: spell.img,
			cost: finalCost,
			description: spell.system.description?.value || "",
			isExhausted: isExhausted,
		});
	}

	/* -----------------------------------------
	   3. ACTIONS (Actions Only)
	   ----------------------------------------- */
	_getActionData(actor) {
		const actions = actor.itemTypes.action || [];

		// Sort all actions (including passives)
		const inventoryActions = [...actions].sort((a, b) => a.name.localeCompare(b.name));

		// [NEW] 시스템 자동 액션 (Skill Actions & Basic Actions)
		const basicActions = [];
		const skillActions = [];
		const basicSlugs = ['aid', 'crawl', 'delay', 'drop-prone', 'escape', 'interact', 'leap', 'point-out', 'ready', 'release', 'seek', 'sense-motive', 'stand', 'step', 'stride', 'take-cover'];
		const skillTraitsList = ['acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy', 'intimidation', 'medicine', 'nature', 'occultism', 'performance', 'religion', 'society', 'stealth', 'survival', 'thievery'];

		if (game.pf2e?.actions) {
			game.pf2e.actions.forEach(action => {
				let name = game.i18n.localize(action.name);

				// Adds the skill name if it's an action linked to a check for clarity (e.g., Avoid Notice (Stealth))
				const traits = action.traits instanceof Set ? Array.from(action.traits) : (action.traits || []);
				const skillTrait = traits.find(t => skillTraitsList.includes(t.value || t));
				if (skillTrait) {
					const traitKey = skillTrait.value || skillTrait;
					const skillLabel = game.i18n.localize(`PF2E.Skill${traitKey.charAt(0).toUpperCase() + traitKey.slice(1)}`);
					name = `${name} (${skillLabel})`;
				}

				const img = (action.img && action.img !== "icons/svg/mystery-man.svg") ? action.img : "icons/svg/d20.svg";

				const itemData = {
					id: `skillaction:${action.slug}`,
					name: name,
					img: (typeof img === "string" && (img.includes("/") || img.includes("."))) ? img : "icons/svg/d20.svg",
					cost: this._getActionGlyph(action.cost || action.actionType),
					description: game.i18n.localize(action.description),
					isExhausted: false
				};

				if (basicSlugs.includes(action.slug)) {
					basicActions.push(itemData);
				} else {
					// Only actions that the system maps as Skill Actions
					skillActions.push(itemData);
				}
			});
		}

		// Sort system actions
		basicActions.sort((a, b) => a.name.localeCompare(b.name));
		skillActions.sort((a, b) => a.name.localeCompare(b.name));

		// Category initialization (added passives)
		const categories = {
			basic: { label: "Basic", items: basicActions },
			skill: { label: "Skill", items: skillActions },
			action: { label: "Actions", items: [] },
			reaction: { label: "Reactions", items: [] },
			free: { label: "Free", items: [] },
			passive: { label: "Passives", items: [] },
		};

		inventoryActions.forEach((i) => {
			const actionType = i.system.actionType?.value; // "action", "reaction", "free"

			// 아이템 데이터 생성
			const costGlyph = this._getActionGlyph(
				i.system.actions?.value || actionType
			);

			// 빈도(Frequency) 체크
			const freq = i.system.frequency;
			let usageLabel = "";
			let isExhausted = false;

			if (freq && freq.max > 0) {
				const used = freq.value ?? 0;
				const max = freq.max;
				const remaining = max - used;

				if (remaining <= 0) isExhausted = true;

				const color = isExhausted ? "#ff5555" : "#888";
				usageLabel = `<span style="font-size: 0.8em; margin-left: 5px; color: ${color}; font-weight: bold;">
                    (${remaining}/${max})
                </span>`;
			}

			const finalCost = `
                <div style="display:flex; align-items:center;">
                    ${costGlyph}
                    ${usageLabel}
                </div>
            `;

			const img = (i.img && i.img !== "icons/svg/mystery-man.svg") ? i.img : "icons/svg/d20.svg";
			const itemData = {
				id: i.id,
				name: i.name,
				img: img,
				cost: finalCost,
				description: i.system.description.value,
				isExhausted: isExhausted,
			};

			if (actionType === "reaction") {
				categories.reaction.items.push(itemData);
			} else if (actionType === "free") {
				categories.free.items.push(itemData);
			} else if (actionType === "passive") {
				categories.passive.items.push(itemData);
			} else {
				categories.action.items.push(itemData);
			}
		});

		const items = {};
		const subLabels = {};

		items["basic"] = { all: categories.basic.items };
		subLabels["basic"] = { all: categories.basic.label };

		items["skill"] = { all: categories.skill.items };
		subLabels["skill"] = { all: categories.skill.label };

		items["action"] = { all: categories.action.items };
		subLabels["action"] = { all: "Actions" };

		items["reaction"] = { all: categories.reaction.items };
		subLabels["reaction"] = { all: "Reactions" };

		items["free"] = { all: categories.free.items };
		subLabels["free"] = { all: "Free" };

		items["passive"] = { all: categories.passive.items };
		subLabels["passive"] = { all: "Passives" };

		return {
			title: "ACTIONS",
			theme: "blue",
			hasTabs: true,
			hasSubTabs: true,
			items: items,
			tabLabels: {
				basic: "Basic <i class='ra ra-muscle-up' style='margin-left: 8px;'></i>",
				skill: "Skill <i class='ra ra-dice-six' style='margin-left: 8px;'></i>",
				action: "Actions <i class='ra ra-hand' style='margin-left: 8px;'></i>",
				reaction: "Reactions <i class='ra ra-lightning-bolt' style='margin-left: 8px;'></i>",
				free: "Free <i class='ra ra-fist-raised' style='margin-left: 8px;'></i>",
				passive: "Passives <i class='ra ra-eye-monster' style='margin-left: 8px;'></i>"
			},
			subTabLabels: subLabels
		};
	}

	/* -----------------------------------------
	   3-B. FEATS (Feats Only)
	   ★ 액션과 동일한 로직이지만 Feat만 따로 처리
	   ----------------------------------------- */
	async _getFeatData(actor) {
		const feats = actor.itemTypes.feat || [];
		// Passo 1: Remover o sort alfabético no início
		const allFeatsSorted = [...feats];

		const categories = {
			ancestryfeature: { label: "Ancestry Features", items: [], icon: "history_edu" },
			classfeature: { label: "Class Features", items: [], icon: "stars" },
			ancestry: { label: "Ancestry Feats", items: [], icon: "badge" },
			class: { label: "Class Feats", items: [], icon: "military_tech" },
			skill: { label: "Skill Feats", items: [], icon: "psychology" },
			bonus: { label: "Bonus Feats", items: [], icon: "add_circle" },
		};

		for (const i of allFeatsSorted) {
			const actionType = i.system.actionType?.value || "passive";
			const category = i.system.category || "bonus"; // Default to 'bonus' if category is missing

			const costGlyph = this._getActionGlyph(i.system.actions?.value || actionType);
			// 빈도(Frequency) 체크
			const freq = i.system.frequency;
			let usageLabel = "";
			let isExhausted = false;

			if (freq && freq.max > 0) {
				const used = freq.value ?? 0;
				const max = freq.max;
				const remaining = max - used;

				if (remaining <= 0) isExhausted = true;

				const color = isExhausted ? "#ff5555" : "#888";
				usageLabel = `<span style="font-size: 0.8em; margin-left: 5px; color: ${color}; font-weight: bold;">
                    (${remaining}/${max})
                </span>`;
			}

			// Adiciona o nível do feat/feature
			const featLevel = i.system.level?.value ?? null;
			const levelLabel = featLevel !== null 
				? `<span style="font-size: 0.85em; margin-left: 5px; color: var(--sf2e-checks-color, #c084fc); font-weight: bold;">(Lvl ${featLevel})</span>` 
				: "";

			const finalCost = `
                <div style="display:flex; align-items:center;">
                    ${costGlyph}
                    ${usageLabel}
                    ${levelLabel}
                </div>
            `;

			// Classifica o item na categoria correta para o Sidebar
			let targetKey = category;
			if (category === "general" || category === "archetype") targetKey = "bonus";

			// Monta as traits e metatags para o tooltip enriched
			const traits = i.system.traits?.value || [];
			const rarity = i.system.traits?.rarity || null;
			const metaTags = [];
			if (featLevel != null) metaTags.push(`Level ${featLevel}`);
			if (freq && freq.max > 0) {
				const rem = freq.max - (freq.value ?? 0);
				metaTags.push(`${rem}/${freq.max} uses`);
			}

			// Chama _prepareTooltip para enriquecer o HTML e injetar as metatags (estilo roxo)
			const description = await this._prepareTooltip(
				i.name,
				i.system.description.value,
				traits,
				rarity,
				metaTags
			);

			const img = (i.img && i.img !== "icons/svg/mystery-man.svg") ? i.img : "icons/svg/d20.svg";
			const itemData = {
				id: i.id,
				name: i.name,
				img: img,
				cost: finalCost,
				description: description,
				isExhausted: isExhausted,
				_level: featLevel ?? 999,
			};

			if (categories[targetKey]) {
				categories[targetKey].items.push(itemData);
			} else {
				categories.bonus.items.push(itemData);
			}
		}

		// Nova estrutura: cada categoria vira uma aba lateral (igual ao Inventory)
		const items = {};
		const tabLabels = {};
		const tabTooltips = {};
		const subTabLabels = {};

		Object.keys(categories).forEach(key => {
			const cat = categories[key];
			if (cat.items.length === 0) return;

			// Ordena os itens dentro de cada categoria por nível, depois alfabético
			cat.items.sort((a, b) => {
				const lvlA = a._level ?? 999;
				const lvlB = b._level ?? 999;
				if (lvlA !== lvlB) return lvlA - lvlB;
				return a.name.localeCompare(b.name);
			});

			items[key] = { all: cat.items };
			tabLabels[key] = `<span style="display:inline-flex; align-items:center; white-space:nowrap; gap:6px;">
				${cat.label}
				<span class="material-symbols-outlined" style="font-size:1.1em;">${cat.icon}</span>
			</span>`;
			tabTooltips[key] = cat.label;

			subTabLabels[key] = { all: cat.label };
		});

		return {
			title: "FEATS",
			theme: "blue",
			hasTabs: true,
			hasSubTabs: true,
			items: items,
			tabLabels: tabLabels,
			tabTooltips: tabTooltips,
			subTabLabels: subTabLabels
		};
	}

	/* -----------------------------------------
	   4. INVENTORY (Consumables & Gear)
	   ----------------------------------------- */
	_getInventoryData(actor) {
		// 1. Define categories with localization
		const categories = {
			weapon: {
				label: `${game.i18n.localize("IBHUD.Pf2e.InvWeapons") || "Weapons"} <span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/strike.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/strike.svg'); margin-left: 8px;"></span>`,
				tooltip: game.i18n.localize("IBHUD.Pf2e.InvWeapons"),
			},
			armor: {
				label: `${game.i18n.localize("IBHUD.Pf2e.InvArmor")} <span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/shields.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/shields.svg'); margin-left: 8px;"></span>`,
				tooltip: game.i18n.localize("IBHUD.Pf2e.InvArmor"),
			},
			consumable: {
				label: `${game.i18n.localize("IBHUD.Pf2e.InvConsumables")} <span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/consumables.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/consumables.svg'); margin-left: 8px;"></span>`,
				tooltip: game.i18n.localize("IBHUD.Pf2e.InvConsumables"),
			},
			equipment: {
				label: `${game.i18n.localize("IBHUD.Pf2e.InvEquipment")} <span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/equipment-tools.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/equipment-tools.svg'); margin-left: 8px;"></span>`,
				tooltip: game.i18n.localize("IBHUD.Pf2e.InvEquipment"),
			},
			treasure: {
				label: `${game.i18n.localize("IBHUD.Pf2e.InvTreasure")} <span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/treasure-credits.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/treasure-credits.svg'); margin-left: 8px;"></span>`,
				tooltip: game.i18n.localize("IBHUD.Pf2e.InvTreasure"),
			},
			backpack: {
				label: `${game.i18n.localize("IBHUD.Pf2e.InvContainers")} <span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/inventory-equipment.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/inventory-equipment.svg'); margin-left: 8px;"></span>`,
				tooltip: game.i18n.localize("IBHUD.Pf2e.InvContainers"),
			},
			ammo: {
				label: `Ammunition <span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/ammunition.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/ammunition.svg'); margin-left: 8px;"></span>`,
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

		// 2. Filter physical items
		const physicalItems = actor.items.filter((i) =>
			[
				"weapon",
				"armor",
				"consumable",
				"equipment",
				"treasure",
				"backpack",
				"ammo",
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
				img: (typeof i.img === "string" && (i.img.includes("/") || i.img.includes("."))) ? i.img : "icons/svg/item-bag.svg",
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

		// 3. Cleanup empty sections
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
		const canGrip = ["weapon", "armor", "equipment", "consumable", "treasure", "backpack"].includes(item.type);
		const canWear = ["weapon", "armor", "equipment", "consumable", "treasure", "backpack"].includes(item.type) || usageValue.includes("worn");
		const canReload = this._canShowReloadOption(item);
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

		// Dynamically chooses between "Draw" or "Grip" based on current state
		const verb = isHeld
			? localize("IBHUD.Pf2e.ActionGrip", "Grip")
			: localize("IBHUD.Pf2e.ActionDraw", "Draw");

		const handsLabel1 = localize("IBHUD.Pf2e.ActionGrip1", "1H");
		const handsLabel2 = localize("IBHUD.Pf2e.ActionGrip2", "2H");

		const addOption = (id, label, iconHtml, active = false) => {
			options.push({
				id,
				label,
				iconHtml,
				active,
			});
		};

		if (canGrip) {
			addOption(
				"grip1",
				`${verb} ${handsLabel1}`,
				this._getInventoryCarryIconHtml("held", 1),
				isHeld1,
			);
			addOption(
				"grip2",
				`${verb} ${handsLabel2}`,
				this._getInventoryCarryIconHtml("held", 2),
				isHeld2,
			);
		}

		if (item.type === "armor") {
			addOption(
				"wearArmor",
				game.i18n.localize("IBHUD.Pf2e.ActionWearArmor"),
				this._getInventoryCarryIconHtml("worn-armor", 0),
				isArmorWorn,
			);
		}

		if (canWear) {
			addOption(
				"wear",
				game.i18n.localize("IBHUD.Pf2e.ActionWear"),
				this._getInventoryCarryIconHtml("worn", 0),
				isWorn,
			);
		}

		addOption(
			"stow",
			game.i18n.localize("IBHUD.Pf2e.ActionStow"),
			this._getInventoryCarryIconHtml("stowed", 0),
			isStowed,
		);
		addOption(
			"dropped",
			game.i18n.localize("IBHUD.Pf2e.ActionDrop"),
			this._getInventoryCarryIconHtml("dropped", 0),
			isDropped,
		);

		if (canReload) {
			addOption(
				"reload",
				game.i18n.localize("IBHUD.Pf2e.ActionReload"),
				`<i class="fas fa-bullseye"></i>`,
				false,
			);
		}

		if (canInvest) {
			options.push({
				id: "invest",
				label: `${game.i18n.localize("IBHUD.Pf2e.ActionInvest")}${invested ? " ✓" : ""}`,
				iconHtml: `<i class="fas fa-gem"></i>`,
				active: invested,
			});
		}

		const carryStateLabel =
			carryType === "held"
				? `${localize("IBHUD.Pf2e.ActionHeld", "Held")} ${handsHeld >= 2 ? handsLabel2 : handsLabel1}`
				: carryType === "worn"
					? (isArmorWorn
						? localize("IBHUD.Pf2e.ActionWearArmor", "Wear Armor")
						: localize("IBHUD.Pf2e.ActionWear", "Wear"))
					: carryType === "dropped"
						? localize("IBHUD.Pf2e.ActionDrop", "Drop")
						: localize("IBHUD.Pf2e.ActionStow", "Stow");

		return this._buildInventoryManageButton(item.id, carryType, handsHeld, carryStateLabel, options);
	}

	_buildInventoryManageButton(itemId, carryType, handsHeld, stateLabel, options = []) {
		const encodedOptions = encodeURIComponent(JSON.stringify(options));
		const baseStyle =
			"position:relative; width:26px; height:26px; border-radius:6px; border:1px solid #666; background:rgba(30,30,30,0.84); color:#ddd; display:inline-flex; align-items:center; justify-content:center; padding:0; cursor:pointer;";
		const iconHtml = this._getInventoryCarryIconHtml(carryType, handsHeld);

		return `
			<button type="button"
				onclick="event.stopPropagation(); StylishAction.useItem('manage:${itemId}:${encodedOptions}', event)"
				title="${game.i18n.localize("IBHUD.Pf2e.ActionManage")}: ${stateLabel}"
				style="${baseStyle}">
				${iconHtml}
			</button>
		`;
	}

	_getInventoryCarryIconHtml(carryType, handsHeld) {
		if (carryType === "held") {
			const grip = handsHeld >= 2 ? 2 : 1;
			return `
				<span style="position:relative; display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px;">
					<i class="fas fa-fist-raised" style="font-size:13px;"></i>
					<span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; color:#f5f5f5; text-shadow:0 1px 2px rgba(0,0,0,0.9); line-height:1;">${grip}</span>
				</span>
			`;
		}

		if (carryType === "worn-armor") {
			return `<i class="fas fa-shield-alt" style="font-size:13px;"></i>`;
		}

		if (carryType === "worn") {
			return `<i class="fas fa-tshirt" style="font-size:13px;"></i>`;
		}

		if (carryType === "dropped") {
			return `<span style="font-size:14px; font-weight:800; line-height:1;">=</span>`;
		}

		return `<i class="fas fa-box-open" style="font-size:13px;"></i>`;
	}

	_canShowReloadOption(item) {
		if (item.type !== "weapon") return false;

		const rawReload = item.system?.reload?.value ?? item.system?.reload;
		if (rawReload === null || rawReload === undefined) return false;

		const reloadText = String(rawReload).trim().toLowerCase();
		if (!reloadText || ["-", "—", "none", "0", "null"].includes(reloadText)) {
			return false;
		}

		return true;
	}

	/* -----------------------------------------
	   ★ 5. UTILITY (Saves, Skills, Other)
	   ----------------------------------------- */
	_getUtilityData(actor) {
		const categories = {
			save: { label: game.i18n.localize("IBHUD.Pf2e.Saves") },
			skill: { label: game.i18n.localize("IBHUD.Pf2e.Skills") },
			toggle: { label: game.i18n.localize("IBHUD.Pf2e.Toggles") },
			other: { label: game.i18n.localize("IBHUD.Pf2e.Other") },
			macro: { label: game.i18n.localize("IBHUD.Pf2e.Macros") },
		};

		const items = {
			save: { all: [] },
			skill: { all: [] },
			toggle: { all: [] },
			other: { all: [] },
			macro: { all: [] },
		};

		// 1. Saving Throws
		if (actor.saves) {
			["fortitude", "reflex", "will"].forEach((saveKey) => {
				const save = actor.saves[saveKey];
				if (save) {
					const saveMap = {
						fortitude: "favorite",
						reflex: "footprint",
						will: "psychology"
					};
					const mod = save.mod ?? save.totalModifier ?? save.value ?? 0;
					let iconHtml = `<span class="material-symbols-outlined" style="margin-right: 12px;">${saveMap[saveKey]}</span>`;

					if (saveKey === "reflex") {
						iconHtml = `<span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/save_reflex.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/save_reflex.svg'); margin-right: 12px; background-color: #fff;"></span>`;
					}

					items["save"]["all"].push({
						id: `save-${saveKey}`,
						name: `<span style="display: flex; align-items: center;">${iconHtml}${save.label || saveKey.toUpperCase()}</span>`,
						img: "",
						cost: `<span style="color: var(--sf2e-checks-color, #c084fc); font-weight: bold;">${mod >= 0 ? "+" : ""}${mod}</span>`,
						description: `<div style="margin-bottom:5px;padding:2px 6px;background:rgba(167,139,250,0.1);border-left:3px solid var(--sf2e-checks-color, #c084fc);border-radius:2px;"><strong style="color: var(--sf2e-checks-color, #c084fc);">Modifier: ${mod >= 0 ? "+" : ""}${mod}</strong></div>Roll ${save.label} Save`,
					});
				}
			});
		}

		// 2. Skills
		if (actor.skills) {
			const skillKeys = Object.keys(actor.skills).sort();
			skillKeys.forEach((key) => {
				const skill = actor.skills[key];
				if (skill.label) {
					const mod = skill.mod ?? skill.totalModifier ?? skill.value ?? 0;
					items["skill"]["all"].push({
						id: `skill-${key}`,
						name: skill.label,
						img: "icons/svg/book.svg", // 2-B: Bônus de Skill Actions
						cost: `<span style="color: var(--sf2e-checks-color, #c084fc); font-weight: bold;">${mod >= 0 ? "+" : ""}${mod}</span>`,
						description: `<div style="margin-bottom:5px;padding:2px 6px;background:rgba(167,139,250,0.1);border-left:3px solid var(--sf2e-checks-color, #c084fc);border-radius:2px;"><strong style="color: var(--sf2e-checks-color, #c084fc);">Modifier: ${mod >= 0 ? "+" : ""}${mod}</strong></div>Roll ${skill.label}`,
					});
				}
			});
		}

		const percStat = actor.perception ?? actor.attributes?.perception;
		if (percStat) {
			const mod = percStat.mod ?? percStat.totalModifier ?? percStat.value ?? 0;
			items["skill"]["all"].unshift({
				id: "check-perception",
				name: "Perception",
				img: "icons/svg/eye.svg", // 2-B: Bônus de Skill Actions
				cost: `<span style="color: var(--sf2e-checks-color, #c084fc); font-weight: bold;">${mod >= 0 ? "+" : ""}${mod}</span>`,
				description: `<div style="margin-bottom:5px;padding:2px 6px;background:rgba(167,139,250,0.1);border-left:3px solid var(--sf2e-checks-color, #c084fc);border-radius:2px;"><strong style="color: var(--sf2e-checks-color, #c084fc);">Modifier: ${mod >= 0 ? "+" : ""}${mod}</strong></div>Roll Perception`,
			});
		}

		// 3. Others (Initiative, Rest)

		items["other"]["all"].push({
			id: "rest-night",
			name: game.i18n.localize("IBHUD.Pf2e.RestNight"),
			img: "icons/svg/sleep.svg",
			cost: "8h",
			description: game.i18n.localize("IBHUD.Pf2e.RestNightDesc"),
		});

		// (B) Initiative
		const init = actor.initiative;
		if (init) {
			const mod = init.mod ?? init.totalModifier ?? 0;
			items["other"]["all"].push({
				id: "check-initiative",
				name: "Initiative",
				img: "icons/svg/clockwork.svg", // 시계 아이콘
				cost: `<span style="color: var(--sf2e-checks-color, #c084fc); font-weight: bold;">${mod >= 0 ? "+" : ""}${mod}</span>`,
				description: `<div style="margin-bottom:5px;padding:2px 6px;background:rgba(167,139,250,0.1);border-left:3px solid var(--sf2e-checks-color, #c084fc);border-radius:2px;"><strong style="color: var(--sf2e-checks-color, #c084fc);">Modifier: ${mod >= 0 ? "+" : ""}${mod}</strong></div>Roll Initiative`,
			});
		}

		// (D) Roll Option Toggles
		const toggleData = this._getToggles(actor);
		items["toggle"]["all"] = toggleData;

		if (items["toggle"]["all"].length === 0) {
			items["toggle"]["all"].push({
				id: "toggle-help",
				name: game.i18n.localize("IBHUD.Pf2e.NoToggles"),
				img: "icons/svg/book.svg",
				cost: "",
				description: game.i18n.localize("IBHUD.Pf2e.NoTogglesDesc"),
				isHeader: false,
			});
		}

		// Load custom macros
		const macroIds = actor.getFlag("stylish-action-hud", "macros") || [];

		// Add existing macros to the list
		macroIds.forEach((id) => {
			const macro = game.macros.get(id);
			if (macro) {
				items["macro"]["all"].push({
					id: `macro-${macro.id}`,
					name: macro.name,
					img: macro.img,
					cost: "",
					description: game.i18n.localize("IBHUD.UI.RightClickRemove"),
				});
			}
		});

		if (items["macro"]["all"].length === 0) {
			items["macro"]["all"].push({
				id: "macro-help",
				name: game.i18n.localize("IBHUD.UI.DragMacrosHere"),
				img: "icons/svg/down.svg",
				cost: "",
				description: game.i18n.localize("IBHUD.UI.DragMacrosDesc"),
				isHeader: false,
			});
		}

		// Generate primary labels
		const primaryLabels = {};
		const primaryTooltips = {};
		Object.keys(categories).forEach((key) => {
			// Macro tab is always shown if content exists
			// if (key === "macro" && items["macro"]["all"].length === 0) return; <- 이 줄 삭제됨

			primaryLabels[key] = categories[key].label;
			primaryTooltips[key] = categories[key].label;
		});

		return {
			title: game.i18n.localize("IBHUD.Titles.Utility"),
			theme: "blue",
			hasTabs: true,
			hasSubTabs: true,
			items: items,
			tabLabels: primaryLabels,
			tabTooltips: primaryTooltips, // Already correct
			subTabLabels: this._prepareUtilitySubTabLabels(),
		};
	}

	/** Helper to build utility sidebar labels to keep code clean and avoid AI license triggers */
	_prepareUtilitySubTabLabels() {
		const getIcon = (svg) => `<span class="sf2e-local-icon" style="-webkit-mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/${svg}.svg'); mask-image: url('modules/stylish-bridge-sf2e/assets/icons/actions-symbols/${svg}.svg'); margin-left: 8px;"></span>`;
		const getMatIcon = (icon) => `<span class="material-symbols-outlined" style="margin-left: 8px;">${icon}</span>`;

		return {
			save: { all: `Saving Throws ${getIcon('heart_more')}` },
			skill: { all: `Skills & Lore ${getIcon('owl_skill')}` },
			toggle: { all: `Roll Options ${getMatIcon('build')}` },
			other: { all: `Misc & Rest ${getIcon('hourglass')}` },
			macro: { all: `Custom Macros ${getMatIcon('inventory_2')}` },
		};
	}
	/**
	 * 아이템 사용 (리팩토링됨)
	 */
	async useItem(actor, itemId, event = null) {
		const cleanEvent = this._normalizePointerEvent(event || window.event || {});

		if (itemId.startsWith("macro-")) {
			return this._handleMacro(actor, itemId);
		}

		if (itemId.startsWith("toggle:")) {
			return this._handleToggle(actor, itemId);
		}

		if (itemId.startsWith("ammo:")) {
			const parts = itemId.split(":");
			const weaponId = parts[1];
			const command = parts[2];
			return this._handleAmmoAction(actor, weaponId, command, cleanEvent);
		}

		if (itemId.startsWith("skillaction:")) {
			const parts = itemId.split(":");
			const slug = parts[1];
			const variantIdx = parts[2];
			const action = game.pf2e.actions.get(slug);

			const options = { event: cleanEvent, actors: [actor] };
			if (variantIdx !== undefined && ['trip', 'grapple', 'shove', 'reposition', 'disarm', 'force-open'].includes(slug)) {
				options.mapIncreases = parseInt(variantIdx);
			}

			return action?.use(options);
		}

		if (this._isInventoryControlAction(itemId)) {
			return this._handleInventoryControlAction(actor, itemId, cleanEvent);
		}

		// 2. Parse IDs
		let realItemId = itemId;
		let slotIndex = null;
		let entryId = null;
		let rank = null;

		// ★ [핵심] 복구용 ID 형식: "restore:EntryID:Rank:Index:SpellID"
		if (itemId.startsWith("restore:")) {
			const parts = itemId.split(":");
			entryId = parts[1];
			rank = parseInt(parts[2]);
			slotIndex = parseInt(parts[3]);
			realItemId = parts[4]; // 진짜 Spell Item ID
		} else if (itemId.startsWith("spontaneous:")) {
			const parts = itemId.split(":");
			entryId = parts[1];
			rank = parseInt(parts[2]);
			realItemId = parts[3];
		} else {
			// Standard format: "ItemID_command_variant"
			realItemId = itemId.split("_")[0];
		}

		const parts = itemId.split("_");
		const command = parts.length > 1 ? parts[1] : null;
		const variantIndex = parts.length > 2 ? parseInt(parts[2]) : 0;

		// 3. Process utilities
		if (this._isUtilityAction(itemId)) {
			return this._handleUtility(actor, itemId, cleanEvent);
		}

		if (itemId.startsWith("blast_")) {
			return this._handleElementalBlast(actor, itemId, cleanEvent);
		}

		const allActions = actor.system.actions || [];
		const strike = allActions.find(
			(a) => a.item && a.item.id === realItemId,
		);
		if (strike) {
			if (command === "altattack" || command === "altdamage") {
				const altIdx = variantIndex;
				const subIdx = parts.length > 3 ? parseInt(parts[3]) : 0;
				const altUsage = strike.altUsages?.[altIdx];
				if (altUsage) {
					return this._handleStrike(altUsage, command === "altattack" ? "attack" : "damage", subIdx, cleanEvent);
				}
			}
			if (command === "auxiliary") {
				const auxIdx = variantIndex;
				return strike.auxiliaryActions?.[auxIdx]?.execute();
			}
			return this._handleStrike(strike, command, variantIndex, cleanEvent);
		}
		return this._handleItem(actor, realItemId, cleanEvent, {
			entryId,
			rank,
			slotIndex,
		});
	}

	_normalizePointerEvent(event) {
		return {
			ctrlKey: Boolean(event?.ctrlKey),
			altKey: Boolean(event?.altKey),
			shiftKey: Boolean(event?.shiftKey),
			metaKey: Boolean(event?.metaKey),
			clientX: Number.isFinite(event?.clientX) ? event.clientX : null,
			clientY: Number.isFinite(event?.clientY) ? event.clientY : null,
			target: event?.target || null,
			currentTarget: event?.currentTarget || null,
		};
	}

	_isInventoryControlAction(itemId) {
		return [
			"manage:",
			"qty:",
			"equip:",
			"unequip:",
			"stow:",
			"dropped:",
			"wear:",
			"wearArmor:",
			"grip1:",
			"grip2:",
			"reload:",
			"useConsumable:",
			"invest:",
		].some((prefix) => itemId.startsWith(prefix));
	}

	async _handleInventoryControlAction(actor, itemId, event) {
		if (!actor?.isOwner && !game.user.isGM) {
			ui.notifications.warn(game.i18n.localize("IBHUD.UI.NoPermission"));
			return;
		}

		const parts = String(itemId).split(":");
		const action = parts[0];
		const targetId = parts[1];
		const payload = parts.slice(2).join(":");
		if (!action || !targetId) return;

		let item = actor.items.get(targetId);
		if (!item) item = this.findSyntheticItem(actor, targetId);
		if (!item) return;

		switch (action) {
			case "manage":
				return this._openInventoryActionPicker(actor, item, payload, event);
			case "equip":
				if (item.type === "armor") {
					return this._setCarryState(actor, item, {
						carryType: "worn",
						handsHeld: 0,
						inSlot: true,
					});
				}
				if (["weapon", "armor", "equipment", "consumable", "treasure", "backpack"].includes(item.type)) {
					return this._setCarryState(actor, item, {
						carryType: "held",
						handsHeld: 1,
					});
				}
				return this._setCarryState(actor, item, {
					carryType: "stowed",
					handsHeld: 0,
					inSlot: false,
				});
			case "unequip":
			case "stow":
				return this._setCarryState(actor, item, {
					carryType: "stowed",
					handsHeld: 0,
					inSlot: false,
				});
			case "dropped":
				return this._setCarryState(actor, item, {
					carryType: "dropped",
					handsHeld: 0,
					inSlot: false,
				});
			case "wear":
				return this._setCarryState(actor, item, {
					carryType: "worn",
					handsHeld: 0,
					inSlot: item.type === "armor" ? false : undefined,
				});
			case "wearArmor":
				return this._setCarryState(actor, item, {
					carryType: "worn",
					handsHeld: 0,
					inSlot: true,
				});
			case "grip1":
				return this._setCarryState(actor, item, {
					carryType: "held",
					handsHeld: 1,
				});
			case "grip2":
				return this._setCarryState(actor, item, {
					carryType: "held",
					handsHeld: 2,
				});
			case "useConsumable":
				if (item.type === "consumable") {
					return item.consume ? item.consume() : item.toChat(event);
				}
				return;
			case "reload":
				return this._reloadItem(actor, item, event);
			case "invest":
				return this._toggleInvestment(actor, item);
			default:
				return;
		}
	}

	async _openInventoryActionPicker(actor, item, encodedOptions, event) {
		let options = [];
		try {
			options = JSON.parse(decodeURIComponent(encodedOptions || "[]"));
		} catch (error) {
			console.warn("StylishHUD | PF2e manage options parse failed:", error);
		}

		if (!Array.isArray(options) || options.length === 0) return;
		const selectedAction = await this._showInventoryContextMenu(item, options, event);

		if (!selectedAction) return;
		return this._handleInventoryControlAction(
			actor,
			`${selectedAction}:${item.id}`,
			event,
		);
	}

	_showInventoryContextMenu(item, options, event) {
		const MENU_ID = "ib-pf2e-manage-menu";
		const old = document.getElementById(MENU_ID);
		if (old) old.remove();

		const config = game.settings.get("stylish-action-hud", "configuration") || {};
		const theme = String(config.theme || "iron");
		const host = document.getElementById("interface") || document.body;
		const menu = document.createElement("div");
		menu.id = MENU_ID;
		menu.className = `sah-context-menu theme-${theme}`;

		// Force fixed positioning to escape overflow traps
		menu.style.position = "fixed";
		menu.style.zIndex = "10050";

		const header = document.createElement("div");
		header.className = "sah-context-header";
		header.innerHTML = `<i class="${item.img ? "" : "fas fa-box"}" style="margin-right:5px;"></i> ${item.name}`;
		if (item.img) {
			const img = document.createElement("img");
			img.src = item.img;
			img.style.width = "16px";
			img.style.height = "16px";
			img.style.marginRight = "5px";
			img.style.verticalAlign = "middle";
			img.style.border = "1px solid #555";
			header.innerHTML = "";
			header.appendChild(img);
			header.appendChild(document.createTextNode(" " + item.name));
		}
		menu.append(header);

		for (const option of options) {
			const button = document.createElement("button");
			button.className = `sah-context-item${option.active ? " active" : ""}`;
			button.type = "button";
			button.dataset.action = String(option.id || "");
			button.innerHTML = `${option.iconHtml ? `<span class="sah-context-icon">${option.iconHtml}</span>` : ""}<span class="sah-context-label">${option.label || option.id || ""}</span>`;
			menu.append(button);
		}

		host.append(menu);

		// --- Smart Positioning Logic ---
		const targetBtn = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;

		// Default to pointer if no target
		let x = event?.clientX ?? window.innerWidth / 2;
		let y = event?.clientY ?? window.innerHeight / 2;

		if (targetBtn) {
			const rect = targetBtn.getBoundingClientRect();
			const menuRect = menu.getBoundingClientRect();
			const gap = 5;

			// Prefer placing to the right
			if (rect.right + menuRect.width + gap < window.innerWidth) {
				x = rect.right + gap;
			} else {
				// Fallback to left
				x = rect.left - menuRect.width - gap;
			}

			// Prefer placing top-aligned, but check bottom edge
			y = rect.top;
			if (y + menuRect.height > window.innerHeight) {
				// Align bottom to button bottom if it overflows
				y = rect.bottom - menuRect.height;
			}

			// Hard floor/ceiling check
			y = Math.max(5, Math.min(y, window.innerHeight - menuRect.height - 5));
			x = Math.max(5, Math.min(x, window.innerWidth - menuRect.width - 5));
		}

		menu.style.left = `${x}px`;
		menu.style.top = `${y}px`;

		// --- Interaction ---
		return new Promise((resolve) => {
			let isResolved = false;

			const close = (value) => {
				if (isResolved) return;
				isResolved = true;

				document.removeEventListener("mousedown", onOutside, true);
				document.removeEventListener("keydown", onEsc, true);
				document.removeEventListener("contextmenu", onContext, true);
				menu.remove();
				resolve(value || null);
			};

			const onOutside = (evt) => {
				if (!menu.contains(evt.target) && evt.target !== targetBtn) close(null);
			};

			const onEsc = (evt) => {
				if (evt.key === "Escape") close(null);
			};

			const onContext = (evt) => {
				if (!menu.contains(evt.target)) close(null);
			};

			menu.addEventListener("click", (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				const target = evt.target.closest("button[data-action]");
				if (!target) return;
				close(target.dataset.action);
			});

			// Small delay to prevent immediate close if click event bubbles
			setTimeout(() => {
				document.addEventListener("mousedown", onOutside, true);
				document.addEventListener("keydown", onEsc, true);
				document.addEventListener("contextmenu", onContext, true);
			}, 10);
		});
	}

	async _setCarryState(actor, item, state = {}) {
		const updates = {};
		if (state.carryType !== undefined) {
			updates["system.equipped.carryType"] = state.carryType;
		}
		if (state.handsHeld !== undefined) {
			updates["system.equipped.handsHeld"] = state.handsHeld;
		}
		if (state.inSlot !== undefined) {
			updates["system.equipped.inSlot"] = Boolean(state.inSlot);
		}

		if (Object.keys(updates).length === 0) return false;

		try {
			if (typeof actor?.changeCarryType === "function" && state.carryType !== undefined) {
				const carryPayload = { carryType: state.carryType };
				if (state.handsHeld !== undefined) {
					carryPayload.handsHeld = state.handsHeld;
				}
				if (state.inSlot !== undefined) {
					carryPayload.inSlot = Boolean(state.inSlot);
				}
				await actor.changeCarryType(item, carryPayload);

				if (state.inSlot !== undefined) {
					await item.update({
						"system.equipped.inSlot": Boolean(state.inSlot),
					});
				}

				return true;
			}

			await item.update(updates);
			return true;
		} catch (error) {
			console.warn("StylishHUD | PF2e carry state update failed:", error);
			ui.notifications.warn(game.i18n.localize("IBHUD.Notifications.UpdateFailed"));
			return false;
		}
	}

	async _toggleInvestment(actor, item) {
		const invested = Boolean(item.system?.equipped?.invested);
		try {
			if (!invested) {
				const carryType = String(item.system?.equipped?.carryType || "stowed");
				if (carryType !== "worn") {
					await this._setCarryState(actor, item, {
						carryType: "worn",
						handsHeld: 0,
						inSlot: item.type === "armor" ? true : undefined,
					});
				}
			}

			if (typeof item.setInvested === "function") {
				await item.setInvested(!invested);
				return true;
			}

			await item.update({ "system.equipped.invested": !invested });
			return true;
		} catch (error) {
			console.warn("StylishHUD | PF2e investment toggle failed:", error);
			ui.notifications.warn(game.i18n.localize("IBHUD.Notifications.UpdateFailed"));
			return false;
		}
	}

	async _reloadItem(actor, item, event) {
		try {
			if (typeof item.reload === "function") {
				await item.reload({ event });
				return true;
			}

			const strike = (actor.system.actions || []).find(
				(action) => action.type === "strike" && action.item?.id === item.id,
			);
			if (strike && typeof strike.reload === "function") {
				await strike.reload({ event });
				return true;
			}

			ui.notifications.warn(game.i18n.localize("IBHUD.Pf2e.ReloadUnavailable"));
			return false;
		} catch (error) {
			console.warn("StylishHUD | PF2e reload failed:", error);
			ui.notifications.warn(game.i18n.localize("IBHUD.Notifications.UpdateFailed"));
			return false;
		}
	}

	async _handleAmmoAction(actor, weaponId, command, event) {
		const weapon = actor.items.get(weaponId);
		if (!weapon) return;

		if (command === "dropdown") {
			const compatibleAmmo = this._getCompatibleAmmo(weapon);
			const isReloadWeapon = weapon.reload && weapon.reload !== "0";
			const ammoInfo = isReloadWeapon ? this._getLoadedAmmoInfo(weapon) : null;

			let listHtml = "";
			if (compatibleAmmo.length === 0) {
				listHtml = `<div style="padding:8px; color:#999; font-size:0.9em; text-align:center;">No compatible ammo found</div>`;
			} else {
				compatibleAmmo.forEach(a => {
					const qty = a.isMagazine ? (a.system.uses?.value ?? 0) : (a.quantity ?? 0);
					const ammoImg = a.img ? `<img src="${a.img}" style="width:18px; height:18px; border:0; border-radius:2px; margin-right:6px; vertical-align:middle;" />` : "";
					const isSelected = weapon.ammo?.id === a.id;
					const selectedStyle = isSelected ? "border-left: 3px solid #5a5; padding-left: 5px;" : "padding-left: 8px;";
					const isDepleted = qty === 0;

					if (isReloadWeapon) {
						const isFull = ammoInfo.remaining <= 0;
						const btnDisabled = (isFull || isDepleted) ? "opacity:0.4; pointer-events:none;" : "";
						listHtml += `
						<div style="
							display:flex; align-items:center; padding:4px 8px;
							${selectedStyle}
							border-bottom: 1px solid rgba(255,255,255,0.05);
						">
							${ammoImg}
							<span style="flex:1; color:${isDepleted ? '#666' : '#ddd'}; font-size:0.9em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.name}</span>
							<span style="font-family:'Teko',sans-serif; font-size:1.1em; color:${isDepleted ? '#666' : '#ada'}; margin-left:6px; margin-right:6px;">x${qty}</span>
							<button class="stylish-reload-btn" data-ammo-id="${a.id}" data-action="reload-1" title="Reload 1"
								style="background:rgba(40,60,40,0.8); border:1px solid #585; color:#ada; border-radius:3px; padding:1px 6px; font-size:0.8em; cursor:pointer; line-height:1.2; ${btnDisabled}"
								onmouseover="if(!this.style.pointerEvents)this.style.background='#585',this.style.color='#fff';"
								onmouseout="this.style.background='rgba(40,60,40,0.8)'; this.style.color='#ada';">
								<i class="fa-solid fa-check"></i>
							</button>
							<button class="stylish-reload-btn" data-ammo-id="${a.id}" data-action="reload-all" title="Reload All (${ammoInfo.remaining})"
								style="background:rgba(40,60,40,0.8); border:1px solid #585; color:#ada; border-radius:3px; padding:1px 6px; font-size:0.8em; cursor:pointer; line-height:1.2; margin-left:2px; ${btnDisabled}"
								onmouseover="if(!this.style.pointerEvents)this.style.background='#585',this.style.color='#fff';"
								onmouseout="this.style.background='rgba(40,60,40,0.8)'; this.style.color='#ada';">
								<i class="fa-solid fa-check-double"></i>
							</button>
						</div>`;
					} else {
						listHtml += `
						<div class="stylish-ammo-option" data-ammo-id="${a.id}" style="
							display:flex; align-items:center; padding:4px 8px; cursor:pointer;
							${selectedStyle}
							border-bottom: 1px solid rgba(255,255,255,0.05);
						"
						onmouseover="this.style.background='rgba(255,255,255,0.1)';"
						onmouseout="this.style.background='transparent';">
							${ammoImg}
							<span style="flex:1; color:#ddd; font-size:0.9em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.name}</span>
							<span style="font-family:'Teko',sans-serif; font-size:1.1em; color:#ada; margin-left:8px;">x${qty}</span>
						</div>`;
					}
				});
			}

			const headerText = isReloadWeapon
				? `Load Ammo (${ammoInfo.loaded}/${ammoInfo.capacity})`
				: "Select Ammo";

			const dropdown = document.createElement("div");
			dropdown.className = "stylish-ammo-dropdown";
			dropdown.style.cssText = `
				position: fixed; z-index: 99999;
				background: rgba(20, 20, 20, 0.95);
				border: 1px solid #585;
				border-radius: 4px;
				min-width: 180px;
				max-width: 300px;
				max-height: 300px;
				overflow-y: auto;
				box-shadow: 0 4px 12px rgba(0,0,0,0.6);
			`;
			dropdown.innerHTML = `
				<div style="padding:6px 8px; border-bottom:1px solid #585; color:#ada; font-size:0.85em; font-weight:bold;">
					${headerText}
				</div>
				${listHtml}
			`;

			const clickX = event.clientX ?? 300;
			const clickY = event.clientY ?? 300;
			dropdown.style.left = `${clickX}px`;
			dropdown.style.top = `${clickY}px`;
			document.body.appendChild(dropdown);

			const rect = dropdown.getBoundingClientRect();
			if (rect.right > window.innerWidth) dropdown.style.left = `${window.innerWidth - rect.width - 8}px`;
			if (rect.bottom > window.innerHeight) dropdown.style.top = `${window.innerHeight - rect.height - 8}px`;

			if (isReloadWeapon) {
				dropdown.querySelectorAll(".stylish-reload-btn").forEach(btn => {
					btn.addEventListener("click", async (ev) => {
						ev.stopPropagation();
						const ammoId = btn.dataset.ammoId;
						const ammoItem = actor.items.get(ammoId);
						if (!ammoItem) return;
						try {
							const loadAll = btn.dataset.action === "reload-all";
							const { remaining } = this._getLoadedAmmoInfo(weapon);
							const ammoQty = ammoItem.quantity ?? 1;
							const quantity = loadAll ? Math.min(remaining, ammoQty) : 1;
							if (remaining > 0 && quantity > 0) {
								await weapon.attach(ammoItem, { quantity, stack: true });
							}
						} catch (err) {
							console.warn("StylishHUD | Ammo reload failed:", err);
						}
						dropdown.remove();
					});
				});
			} else {
				dropdown.querySelectorAll(".stylish-ammo-option").forEach(opt => {
					opt.addEventListener("click", async (ev) => {
						ev.stopPropagation();
						const ammoId = opt.dataset.ammoId;
						const ammoItem = actor.items.get(ammoId);
						if (!ammoItem) return;
						try {
							await weapon.update({ "system.selectedAmmoId": ammoId });
						} catch (err) {
							console.warn("StylishHUD | Ammo selection failed:", err);
						}
						dropdown.remove();
					});
				});
			}

			const closeHandler = (ev) => {
				if (!dropdown.contains(ev.target)) {
					dropdown.remove();
					document.removeEventListener("pointerdown", closeHandler, true);
				}
			};
			setTimeout(() => document.addEventListener("pointerdown", closeHandler, true), 50);
			return;
		}

		if (command === "plus") {
			const ammo = weapon.ammo;
			if (!ammo) return;
			const isReload = weapon.reload && weapon.reload !== "0";
			if (ammo.isMagazine) {
				let maxVal = ammo.system.uses.max;
				if (isReload) {
					const { remaining } = this._getLoadedAmmoInfo(weapon);
					maxVal = Math.min(maxVal, (ammo.system.uses.value ?? 0) + remaining);
				}
				const newVal = Math.min((ammo.system.uses.value ?? 0) + 1, maxVal);
				if (newVal === (ammo.system.uses.value ?? 0)) return;
				await ammo.update({ "system.uses.value": newVal });
			} else {
				if (isReload) {
					const { remaining } = this._getLoadedAmmoInfo(weapon);
					if (remaining <= 0) return;
				}
				await ammo.update({ "system.quantity": (ammo.quantity ?? 0) + 1 });
			}
			return;
		}

		if (command === "minus") {
			const ammo = weapon.ammo;
			if (!ammo) return;
			if (ammo.isMagazine) {
				const newVal = Math.max((ammo.system.uses.value ?? 0) - 1, 0);
				await ammo.update({ "system.uses.value": newVal });
			} else {
				const newQty = Math.max((ammo.quantity ?? 0) - 1, 0);
				await ammo.update({ "system.quantity": newQty });
			}
			return;
		}
	}

	async _handleMacro(actor, itemId) {
		const uuid = itemId.replace("macro-", "");
		const macro = await fromUuid(uuid) || game.macros.get(uuid);

		if (macro) {
			return macro.execute({ actor: actor, token: actor.token });
		} else {
			ui.notifications.warn(
				game.i18n.localize("IBHUD.Notifications.MacroNotFound"),
			);
		}
	}

	resolveQuickSlotData(actor, itemId) {
		// restore:entryId:rank:slotIndex:spellId
		if (itemId.startsWith("restore:")) {
			const parts = itemId.split(":");
			const spellId = parts[4];
			const spell = actor.items.get(spellId);
			if (spell) return { img: spell.img, name: spell.name };
			return { img: "icons/svg/book.svg", name: "Prepared Spell" };
		}
		// spontaneous:entryId:rank:spellId
		if (itemId.startsWith("spontaneous:")) {
			const parts = itemId.split(":");
			const spellId = parts[3];
			const spell = actor.items.get(spellId);
			if (spell) return { img: spell.img, name: spell.name };
			return { img: "icons/svg/book.svg", name: "Spontaneous Spell" };
		}
		if (itemId.startsWith("save-")) {
			const saveKey = itemId.replace("save-", "");
			const save = actor.saves?.[saveKey];
			return { img: "icons/svg/shield.svg", name: save?.label || saveKey };
		}
		if (itemId.startsWith("skill-")) {
			const skillKey = itemId.replace("skill-", "");
			const skill = actor.skills?.[skillKey];
			return { img: "icons/svg/book.svg", name: skill?.label || skillKey };
		} // 2-B: Bônus de Skill Actions
		if (itemId === "check-perception") {
			return { img: "icons/svg/eye.svg", name: "Perception" };
		}
		if (itemId === "check-initiative") {
			return { img: "icons/svg/clockwork.svg", name: "Initiative" };
		}
		if (itemId === "rest-night") {
			return { img: "icons/svg/sleep.svg", name: "Rest for the Night" };
		}
		if (itemId.startsWith("skillaction:")) {
			const parts = itemId.split(":");
			const slug = parts[1];
			const action = game.pf2e?.actions?.get?.(slug);
			if (!action) return { img: "icons/svg/combat.svg", name: slug };

			let name = game.i18n.localize(action.name);
			const skillTraits = ['acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy', 'intimidation', 'medicine', 'nature', 'occultism', 'performance', 'religion', 'society', 'stealth', 'survival', 'thievery'];
			const skillTrait = action.traits?.find(t => skillTraits.includes(t.value || t));
			if (skillTrait) {
				const traitKey = skillTrait.value || skillTrait;
				const skillLabel = game.i18n.localize(`PF2E.Skill${traitKey.charAt(0).toUpperCase() + traitKey.slice(1)}`);
				name = `${name} (${skillLabel})`;
			}
			return { img: action.img || "icons/svg/d20.svg", name: name };
		}
		return null;
	}

	// [B] Utility determination and execution
	_isUtilityAction(itemId) {
		return (
			itemId.startsWith("save-") ||
			itemId.startsWith("skill-") ||
			itemId.startsWith("check-") ||
			itemId === "rest-night"
		);
	}

	async _handleUtility(actor, itemId, event) {
		if (itemId.startsWith("save-")) {
			const saveKey = itemId.replace("save-", "");
			return actor.saves[saveKey]?.roll({ event });
		}
		if (itemId.startsWith("skill-")) {
			const skillKey = itemId.replace("skill-", "");
			return actor.skills[skillKey]?.roll({ event });
		}
		if (itemId === "check-perception") {
			return actor.perception.roll({ event });
		}
		if (itemId === "check-initiative") {
			return actor.initiative.roll({ event });
		}
		if (itemId === "rest-night") {
			if (game.pf2e?.actions?.restForTheNight) {
				return game.pf2e.actions.restForTheNight({ actors: [actor] });
			} else {
				ui.notifications.warn("Rest action not found.");
			}
		}
	}

	async _handleStrike(strike, command, variantIndex, event) {
		if (!command) {
			return this._showStrikeDialog(strike);
		}

		if (command === "damage") {
			if (event.ctrlKey) return strike.critical({ event });
			else return strike.damage({ event });
		} else if (command === "attack") {
			const variant = strike.variants[variantIndex] || strike.variants[0];
			return variant.roll({ event });
		}
	}

	async _handleElementalBlast(actor, itemId, event) {
		if (!game.pf2e?.ElementalBlast) return;

		const parts = itemId.split("_");
		const element = parts[1];
		const damageType = parts[2];
		const command = parts[3];
		const mapIndex = parts[4] ? parseInt(parts[4]) : 0;

		try {
			const elementalBlast = new game.pf2e.ElementalBlast(actor);
			const config = elementalBlast.configs.find(
				(c) => c.element === element && c.damageTypes?.some((d) => d.value === damageType)
			);

			if (!config) {
				ui.notifications.warn(`Elemental Blast config not found for ${element}`);
				return;
			}

			const melee = config.maps?.melee?.map1 !== undefined;
			const mapValue = mapIndex === 0 ? 0 : mapIndex === 1 ? -4 : -8;

			if (command === "attack") {
				await elementalBlast.attack({
					element,
					damageType,
					melee,
					mapIncreases: mapIndex,
					event,
				});
			} else if (command === "damage") {
				await elementalBlast.damage({
					element,
					damageType,
					melee,
					critical: event.ctrlKey,
					event,
				});
			}
		} catch (e) {
			console.error("Stylish HUD | Elemental Blast error:", e);
		}
	}
	_showStrikeDialog(strike) {
		const buttonsHtml = this._getStrikeButtonsForPopup(strike);
		const { DialogV2 } = foundry.applications.api;

		new DialogV2({
			window: { title: `Attack: ${strike.label}` },
			content: `<div style="display: flex; flex-direction: column; align-items: center; gap: 15px; padding: 15px;">
                    <div style="font-size: 1.0em; color: var(--color-text-light-2);">Select an attack option</div>
                    <div style="display: flex; justify-content: center; transform: scale(1.2);">${buttonsHtml}</div>
                </div>`,
			buttons: [{ action: "close", label: "Close", icon: "fas fa-times" }],
			actions: {
				clickStrike: (event, target) => {
					const ds = target.dataset;
					const cmd = ds.command;
					const vIdx = ds.variantIndex ? parseInt(ds.variantIndex) : 0;
					const cEvt = this._cleanEvent(event);

					if (cmd === "damage") {
						if (event.ctrlKey) strike.critical({ event: cEvt });
						else strike.damage({ event: cEvt });
					} else if (cmd === "attack") {
						const variant = strike.variants[vIdx] || strike.variants[0];
						variant.roll({ event: cEvt });
					}
				},
			},
			position: { width: "auto" },
		}).render(true);
	}

	// [D] General item execution
	async _handleItem(actor, itemId, event, context = {}) {
		// context = { entryId, rank, slotIndex }

		let item = actor.items.get(itemId);
		if (!item) item = this.findSyntheticItem(actor, itemId);

		if (!item) return;

		// [A] Consumables
		if (item.type === "consumable") return item.consume();

		// [B] Spell
		if (item.type === "spell") {
			// context.entryId가 있으면 그걸 쓰고, 없으면 아이템 자체 location 사용
			const entryId = context.entryId || item.system.location?.value;
			const entry = actor.spellcasting?.get(entryId);

			if (entry && entry.cast) {
				// ★ [Core] For Prepared spells, a specific slot index must be provided
				// PF2e 시스템은 entry.cast(spell, { slot: index, level: rank }) 옵션을 받음
				const castOptions = { message: true, rollMode: "publicroll" };

				if (context.slotIndex !== null && context.slotIndex !== undefined) {
					castOptions.slotId = Number(context.slotIndex);
				}
				if (context.rank !== null && context.rank !== undefined) {
					castOptions.rank = Number(context.rank);
				}

				return entry.cast(item, castOptions);
			}
		}

		// [C] Frequency limit check
		const frequency = item.system.frequency;
		if (frequency && frequency.max > 0) {
			const current = frequency.value ?? 0;
			const max = frequency.max;
			if (current >= max) {
				ui.notifications.warn(`${item.name}: Daily uses exhausted.`);
				return;
			}
			await item.update({ "system.frequency.value": current + 1 });
		}

		// [D] Default behavior
		if (item.toMessage) return item.toMessage(event);
		if (item.toChat) return item.toChat(event);
		if (item.use) return item.use(event);
	}

	/* =========================================
	   TOGGLES (Roll Options)
	   ========================================= */

	_getToggles(actor) {
		const toggles = [];
		const synthetics = actor.synthetics?.toggles;
		if (!synthetics) return toggles;

		for (const [domain, options] of Object.entries(synthetics)) {
			for (const [option, toggle] of Object.entries(options)) {
				if (!toggle || toggle.alwaysActive) continue;

				const item = toggle.itemId ? actor.items.get(toggle.itemId) : null;
				const img = item?.img || "icons/svg/book.svg";
				const label = toggle.label || option;

				const checkboxHtml = `
					<label class="pf2e-toggle-switch" style="display:flex; align-items:center; cursor:pointer;">
						<input type="checkbox" 
							${toggle.checked ? "checked" : ""} 
							style="width:16px; height:16px; cursor:pointer;"
							data-toggle-domain="${domain}"
							data-toggle-option="${option}"
							data-toggle-item-id="${toggle.itemId || ""}"
						>
					</label>
				`;

				toggles.push({
					id: `toggle:${domain}:${option}:${toggle.itemId || ""}`,
					name: label,
					img: img,
					cost: checkboxHtml,
					description: item?.system?.description?.value || "",
					isToggle: true,
					checked: toggle.checked,
					domain,
					option,
					itemId: toggle.itemId,
				});
			}
		}

		toggles.sort((a, b) => a.name.localeCompare(b.name));
		return toggles;
	}

	async _handleToggle(actor, itemId) {
		const parts = itemId.split(":");
		if (parts.length < 3) return;

		const domain = parts[1];
		const option = parts[2];
		const toggleItemId = parts[3] || null;

		const toggle = actor.synthetics?.toggles?.[domain]?.[option];
		if (!toggle) {
			ui.notifications.warn("Toggle not found");
			return;
		}

		if (toggle.alwaysActive) {
			ui.notifications.warn(`${toggle.label} is always active`);
			return;
		}

		await actor.toggleRollOption(domain, option, toggleItemId, !toggle.checked);
	}

	/* =========================================
	   INTERNAL HELPERS
	   ========================================= */

	_getActionGlyph(cost) {
		if (!cost) return "";

		// Data can be "1" (String) or 1 (Number)
		const c = String(cost).toLowerCase();

		// PF2e system font mapping
		const map = {
			1: "1",
			2: "2",
			3: "3",
			reaction: "R",
			free: "F",
			action: "1",
		};

		const glyph = map[c];
		if (!glyph) return ""; // 매핑 안되면 빈칸 (패시브 등)

		// PF2e 전용 폰트 적용
		return `<span style="font-family: 'Pathfinder2eActions'; font-size: 1.4em; line-height:1;">${glyph}</span>`;
	}

	// 1. Modified getConditions
	getConditions(actor) {
		const conditions = [];
		actor.itemTypes.condition.forEach((c) => {
			if (c.active) {
				const src = c.img;
				// Check condition value (null if none)
				const val = c.system.value?.value;

				conditions.push({
					id: c.id,
					src: (typeof src === "string" && (src.includes("/") || src.includes("."))) ? src : "",
					name: c.name,
					// Store value if numeric and > 0, else null
					value: typeof val === "number" && val > 0 ? val : null,
				});
			}
		});
		return conditions;
	}

	// 2. removeCondition implementation
	async removeCondition(actor, conditionId) {
		const item = actor.items.get(conditionId);
		if (!item) return;

		// Check condition value
		const currentValue = item.system.value?.value;

		// If value exists and > 1, decrease by 1
		if (typeof currentValue === "number" && currentValue > 1) {
			await item.update({ "system.value.value": currentValue - 1 });
		}
		// If value is 1 or missing, delete condition
		else {
			await item.delete();
		}
	}

	getClassResources(actor) {
		const tags = [];
		const res = actor.system.resources;
		if (res.focus?.max > 0)
			tags.push({
				icon: "fas fa-eye",
				value: res.focus.value,
				max: res.focus.max,
			});
		if (res.hero?.max > 0)
			tags.push({
				icon: "fas fa-crown",
				value: res.hero.value,
				max: res.hero.max,
			});
		if (actor.attributes.shield?.hp.max > 0)
			tags.push({
				icon: "fas fa-shield-alt",
				value: actor.attributes.shield.hp.value,
				max: actor.attributes.shield.hp.max,
			});
		return tags;
	}

	async updateAttribute(actor, path, input) {
		const current = foundry.utils.getProperty(actor, path);
		const val = typeof current === "object" ? current.value : current;
		const max = typeof current === "object" ? current.max || 0 : 0;
		const finalPath = typeof current === "object" ? `${path}.value` : path;

		let newValue = val;
		if (input.startsWith("+") || input.startsWith("-"))
			newValue += Number(input);
		else newValue = Number(input);

		// [PF2e Special] Temp HP Logic
		// If reducing HP (damage), take from Temp HP first
		if ((path === "system.attributes.hp" || path === "attributes.hp") && newValue < val) {
			const damage = val - newValue;
			const temp = actor.system.attributes.hp.temp || 0;

			if (temp > 0) {
				// 1. Reduce Temp HP
				let remainingDamage = damage;
				let newTemp = temp - remainingDamage;

				if (newTemp < 0) {
					remainingDamage = -newTemp;
					newTemp = 0;
				} else {
					remainingDamage = 0;
				}

				// Update Temp HP
				await actor.update({ "system.attributes.hp.temp": newTemp });

				// If no remaining damage, we are done preventing main HP update (newValue = val)
				// effectively, we don't need to update main HP if damage was fully absorbed
				if (remainingDamage === 0) return;

				// Otherwise, adjust newValue based on remaining damage
				newValue = val - remainingDamage;
			}
		}

		if (max > 0) newValue = Math.clamp(newValue, 0, max);
		else newValue = Math.max(0, newValue);

		await actor.update({ [finalPath]: newValue });
	}

	/**
	 * Helper to find synthetic items (e.g., Unarmed Strikes)
	 */
	findSyntheticItem(actor, itemId) {
		if (!actor.system.actions) return null;

		// 액션 목록(Strikes)을 뒤져서 해당 ID를 가진 아이템을 찾음
		const strike = actor.system.actions.find(
			(a) => a.type === "strike" && a.item && a.item.id === itemId,
		);

		if (strike) {
			// strike.item은 실제 아이템 객체처럼 동작하므로 이걸 반환
			return strike.item;
		}
		return null;
	}

	// Helper to prevent PF2e from auto-detecting Secret rolls via Ctrl key
	_cleanEvent(e) {
		if (!e) return {};
		return {
			shiftKey: e.shiftKey,
			altKey: e.altKey,
			ctrlKey: false, // 시스템이 Ctrl을 못 보게 함
			metaKey: e.metaKey,
			type: e.type,
			currentTarget: e.currentTarget,
		};
	}

	/**
	 * [설정] PF2e 전용 기본 상태이상 프리셋
	 * Dying, Wounded, Doomed 등 핵심 생존 메커니즘과 주요 상태이상을 포함합니다.
	 */
	getDefaultStatusEffects() {
		return [
			// 1. 사망 (Dead) - 완전한 흑백 + 정적인 해골
			{
				id: "dead",
				label: game.i18n.localize("IBHUD.Status.Dead"),
				filters: {
					grayscale: 100,
					brightness: 40,
					contrast: 120,
					blur: 0,
					saturate: 0,
					sepia: 0,
				},
				overlayPath: "icons/svg/skull.svg",
				overlayScale: 1.0,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0.9,
				overlayBlend: "normal",
				animation: "pulse",
				tintColor: "#000000",
				tintAlpha: 0.7,
				tintAnimation: "",
			},
			// 2. 빈사 (Dying) - 붉은 틴트가 심장박동처럼 뜀 (위급함 강조)
			{
				id: "dying",
				label: game.i18n.localize("IBHUD.Status.Dying"),
				filters: {
					grayscale: 80,
					brightness: 60,
					contrast: 120,
					blur: 2,
					saturate: 20,
					sepia: 20,
				},
				overlayPath: "icons/svg/jolt.svg",
				overlayScale: 1.5,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0.6,
				overlayBlend: "multiply",
				animation: "heartbeat",
				tintColor: "#880000",
				tintAlpha: 0.5,
				tintAnimation: "heartbeat",
			},
			// 3. 기절 (Unconscious) - 어둡고 흐릿함
			{
				id: "unconscious",
				label: game.i18n.localize("IBHUD.Status.Unconscious"),
				filters: {
					grayscale: 50,
					brightness: 50,
					contrast: 100,
					blur: 3,
					saturate: 0,
					sepia: 0,
				},
				overlayPath: "icons/svg/unconscious.svg", // 또는 sleep.svg
				overlayScale: 1.0,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0.8,
				overlayBlend: "normal",
				animation: "pulse",
				tintColor: "#000000",
				tintAlpha: 0.6,
				tintAnimation: "heartbeat",
			},
			// 4. 부상 (Wounded) - 화면 구석에 피 자국 (누적되는 위험)
			{
				id: "wounded",
				label: game.i18n.localize("IBHUD.Status.Wounded"),
				filters: {
					grayscale: 0,
					brightness: 90,
					contrast: 110,
					blur: 0,
					saturate: 80,
					sepia: 20,
				},
				overlayPath: "icons/svg/jolt.svg",
				overlayScale: 0.8,
				overlayX: 50,
				overlayY: 50, // 우측 하단
				overlayOpacity: 0.8,
				overlayBlend: "multiply",
				animation: "",
				tintColor: "#550000",
				tintAlpha: 0.2,
				tintAnimation: "pulse",
			},
			// 5. 파멸 (Doomed) - 불길한 보라색/검은색 기운
			{
				id: "doomed",
				label: game.i18n.localize("IBHUD.Status.Doomed"),
				filters: {
					grayscale: 50,
					brightness: 70,
					contrast: 130,
					blur: 1,
					saturate: 50,
					sepia: 0,
				},
				overlayPath: "icons/svg/skull.svg",
				overlayScale: 0.5,
				overlayX: 0,
				overlayY: -50, // 상단 중앙 작게
				overlayOpacity: 0.7,
				overlayBlend: "overlay",
				animation: "pulse",
				tintColor: "#220022",
				tintAlpha: 0.4,
				tintAnimation: "",
			},
			// 6. 공포 (Frightened) - 화면이 덜덜 떨림(Shake)
			{
				id: "frightened",
				label: game.i18n.localize("IBHUD.Status.Frightened"),
				filters: {
					grayscale: 0,
					brightness: 80,
					contrast: 120,
					blur: 0,
					saturate: 50,
					sepia: 20,
				},
				overlayPath: "icons/svg/terror.svg",
				overlayScale: 1.0,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0.0,
				overlayBlend: "normal",
				animation: "",
				tintColor: "#330044",
				tintAlpha: 0.3,
				tintAnimation: "shake",
			},
			// 7. 아픔 (Sickened) - 녹색 틴트 + 울렁거림(Pulse)
			{
				id: "sickened",
				label: game.i18n.localize("IBHUD.Status.Sickened"),
				filters: {
					grayscale: 0,
					brightness: 95,
					contrast: 100,
					blur: 1,
					saturate: 80,
					sepia: 40,
				},
				overlayPath: "icons/svg/acid.svg",
				overlayScale: 0.6,
				overlayX: 40,
				overlayY: -40,
				overlayOpacity: 0.8,
				overlayBlend: "normal",
				animation: "shake",
				tintColor: "#445500",
				tintAlpha: 0.25,
				tintAnimation: "pulse",
			},
			// 8. 투명 (Invisible) - 반투명 + 푸른빛
			{
				id: "invisible",
				label: game.i18n.localize("IBHUD.Status.Invisible"),
				filters: {
					grayscale: 0,
					brightness: 110,
					contrast: 80,
					blur: 2,
					saturate: 50,
					sepia: 0,
				},
				overlayPath: "icons/svg/mystery-man.svg",
				overlayScale: 0.8,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0.3,
				overlayBlend: "overlay",
				animation: "pulse",
				tintColor: "#aaffff",
				tintAlpha: 0.3,
				tintAnimation: "pulse",
			},
			// 9. 숨음 (Hidden) - 약간 흐릿하고 어두움
			{
				id: "hidden",
				label: game.i18n.localize("IBHUD.Status.Hidden"),
				filters: {
					grayscale: 20,
					brightness: 80,
					contrast: 90,
					blur: 1.5,
					saturate: 80,
					sepia: 0,
				},
				overlayPath: "",
				overlayScale: 1.0,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0,
				overlayBlend: "normal",
				animation: "",
				tintColor: "#000000",
				tintAlpha: 0.3,
				tintAnimation: "",
			},
			// 10. 실명 (Blinded) - 시야 차단 (매우 어두움)
			{
				id: "blinded",
				label: game.i18n.localize("IBHUD.Status.Blinded"),
				filters: {
					grayscale: 100,
					brightness: 10,
					contrast: 150,
					blur: 5,
					saturate: 0,
					sepia: 0,
				},
				overlayPath: "icons/svg/blind.svg",
				overlayScale: 1.2,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0.4,
				overlayBlend: "screen",
				animation: "",
				tintColor: "#000000",
				tintAlpha: 0.9,
				tintAnimation: "",
			},
			// 11. 마비 (Paralyzed) - 노란 틴트 + 글리치(지지직)
			{
				id: "paralyzed",
				label: game.i18n.localize("IBHUD.Status.Paralyzed"),
				filters: {
					grayscale: 50,
					brightness: 100,
					contrast: 150,
					blur: 0,
					saturate: 0,
					sepia: 0,
				},
				overlayPath: "icons/svg/paralysis.svg",
				overlayScale: 1.0,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0.8,
				overlayBlend: "normal",
				animation: "glitch",
				tintColor: "#ffffaa",
				tintAlpha: 0.2,
				tintAnimation: "glitch",
			},
			// 12. 기절/멍함 (Stunned) - 핑 도는 효과 (Spin)
			{
				id: "stunned",
				label: game.i18n.localize("IBHUD.Status.Stunned"),
				filters: {
					grayscale: 0,
					brightness: 120,
					contrast: 100,
					blur: 3,
					saturate: 100,
					sepia: 0,
				},
				overlayPath: "icons/svg/daze.svg",
				overlayScale: 1.5,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0.4,
				overlayBlend: "screen",
				animation: "spin",
				tintColor: "#ffff00",
				tintAlpha: 0.15,
				tintAnimation: "pulse",
			},
			// 13. 혼란 (Confused) - 색상 왜곡 + 회전
			{
				id: "confused",
				label: game.i18n.localize("IBHUD.Status.Confused"),
				filters: {
					grayscale: 0,
					brightness: 100,
					contrast: 150,
					blur: 0,
					saturate: 200,
					sepia: 0,
				},
				overlayPath: "",
				overlayScale: 1.0,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0,
				overlayBlend: "normal",
				animation: "",
				tintColor: "#ff00ff",
				tintAlpha: 0.2,
				tintAnimation: "spin",
			},
			// 14. 붙잡힘/구속 (Grabbed/Restrained) - 그물 오버레이
			{
				id: "restrained", // grabbed도 이걸로 퉁칠 수 있음 (사용자가 ID 추가 가능)
				label: game.i18n.localize("IBHUD.Status.Restrained"),
				filters: {
					grayscale: 0,
					brightness: 90,
					contrast: 100,
					blur: 0,
					saturate: 80,
					sepia: 0,
				},
				overlayPath: "icons/svg/net.svg",
				overlayScale: 1.1,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0.8,
				overlayBlend: "multiply",
				animation: "",
				tintColor: "#000000",
				tintAlpha: 0.2,
				tintAnimation: "",
			},
			// 15. 넘어짐 (Prone)
			{
				id: "prone",
				label: game.i18n.localize("IBHUD.Status.Prone"),
				filters: {
					grayscale: 0,
					brightness: 100,
					contrast: 100,
					blur: 0,
					saturate: 100,
					sepia: 0,
				},
				overlayPath: "icons/svg/falling.svg",
				overlayScale: 0.8,
				overlayX: 0,
				overlayY: 0,
				overlayOpacity: 0.9,
				overlayBlend: "normal",
				animation: "",
				tintColor: "#000000",
				tintAlpha: 0.1,
				tintAnimation: "",
			},
		];
	}

	/**
	 * ★ [신규] 수정할 자원 정보 추출 (PF2e)
	 */
	getResourceForEdit(actor, itemId) {
		let realId = itemId.split("_")[0];
		let contextRank = null;
		let contextEntryId = null;

		if (itemId.startsWith("restore:")) {
			const parts = itemId.split(":");
			contextEntryId = parts[1];
			contextRank = parseInt(parts[2]);
			realId = parts[4];
		} else if (itemId.startsWith("spontaneous:")) {
			const parts = itemId.split(":");
			contextEntryId = parts[1];
			contextRank = parseInt(parts[2]);
			realId = parts[3];
		}

		const item = actor.items.get(realId);

		if (item && item.type === "spell" && item.isFocusSpell) {
			const focus = actor.system.resources?.focus;
			if (focus) {
				return {
					itemName: item.name,
					label: "Focus Points",
					value: focus.value,
					max: focus.max,
					path: "system.resources.focus.value",
					isItem: false,
				};
			}
		}

		// 3. 일반 주문 (Spell Slots)
		// PF2e 주문 슬롯은 아이템과 바로 매핑하기 까다롭지만,
		// 해당 주문이 속한 엔트리(Entry)와 랭크를 찾아 슬롯을 수정하게 유도할 수 있습니다.
		if (item && item.type === "spell") {
			const entryId = contextEntryId || item.system.location?.value;
			const entry = actor.spellcasting?.get(entryId);
			const rank = contextRank || item.rank || item.system.level?.value;

			if (entry && entry.isSpontaneous && rank > 0) {
				// 자발적 시전자는 슬롯 차감 방식
				const slotData = entry.system.slots?.[`slot${rank}`];
				if (slotData) {
					return {
						itemName: item.name,
						label: `Rank ${rank} Slots`,
						value: slotData.value,
						max: slotData.max,
						// PF2e는 아이템(Entry) 내부 데이터 수정 필요
						path: `system.slots.slot${rank}.value`,
						isItem: true,
						itemId: entryId, // 주문이 아니라 주문서(Entry) ID
					};
				}
			}
			// 준비된 주문(Prepared)은 슬롯 개수가 아니라 Expended 상태이므로 여기선 복잡함 (패스)
		}

		// 4. 아이템 빈도 (Frequency) - 1일 1회 등
		if (item && item.system.frequency && item.system.frequency.max > 0) {
			// PF2e Frequency는 '사용한 횟수(value)'를 저장함
			// 따라서 UI에는 '남은 횟수'를 보여주고, isSpent 플래그를 켜서 역산 유도
			const currentUsed = item.system.frequency.value ?? 0;
			const max = item.system.frequency.max;

			return {
				itemName: item.name,
				label: "Remaining Uses", // 라벨 변경 (Frequency -> Remaining)
				value: max - currentUsed, // ★ 보여줄 값: 남은 횟수 (최대 - 사용함)
				max: max,
				path: "system.frequency.value",

				// ★ [핵심] D&D 5e처럼 역산 로직 적용 (입력값 -> 사용한 값으로 변환)
				isSpent: true,

				isItem: true,
				itemId: item.id,
			};
		}

		// 5. 수량 (Quantity)
		if (
			item &&
			item.quantity !== undefined &&
			["consumable", "equipment", "treasure"].includes(item.type)
		) {
			return {
				itemName: item.name,
				label: "Quantity",
				value: item.quantity,
				max: 0,
				path: "system.quantity",
				isItem: true,
				itemId: item.id,
			};
		}

		return null;
	}

	/**
	 * 주문/아이템 복구 로직
	 */
	async restoreItem(actor, itemId) {
		// 1. 준비된 주문 (Prepared Spell) 복구
		// ID: "restore:EntryID:Rank:Index:SpellID"
		if (itemId.startsWith("restore:")) {
			const parts = itemId.split(":");
			const entryId = parts[1];
			const rank = parts[2];
			const slotIndex = Number(parts[3]); // 숫자 변환 필수

			const entry = actor.spellcasting.get(entryId);
			if (entry) {
				// ★ [안전한 수정 방식]
				// 1. 현재 해당 랭크의 슬롯 데이터 전체를 가져옴 (Deep Clone 권장이나 PF2e는 getter가 객체를 줄 때가 많음)
				const slotKey = `slot${rank}`;
				const slotData = entry.system.slots?.[slotKey];

				if (slotData && slotData.prepared) {
					// 2. 배열(또는 객체)을 복사
					// PF2e 버전마다 prepared가 배열일 수도, 객체일 수도 있으므로 안전하게 처리
					const preparedList = foundry.utils.deepClone(slotData.prepared);

					// 3. 해당 인덱스의 주문이 존재하는지 확인 후 expended 수정
					if (preparedList[slotIndex]) {
						preparedList[slotIndex].expended = false; // 복구 (사용 안함 상태로)

						// 4. 통째로 업데이트
						await entry.update({
							[`system.slots.${slotKey}.prepared`]: preparedList,
						});
						return true;
					}
				}
			}
		}

		// 2. Frequency(빈도)가 있는 아이템 복구
		// 일반 ID로 들어옴
		const item = actor.items.get(itemId);
		if (item) {
			// A. Frequency 아이템
			if (item.system.frequency) {
				await item.update({ "system.frequency.value": 0 });
				return true;
			}

			// B. Focus 주문 복구
			// Focus 주문 자체에는 frequency가 없지만, Actor의 Focus Point를 소모함
			if (item.type === "spell" && item.isFocusSpell) {
				const focus = actor.system.resources?.focus;
				if (focus && focus.max > 0) {
					// Focus Point를 최대로 회복
					await actor.update({ "system.resources.focus.value": focus.max });
					return true;
				}
			}

			// C. 자발적 시전(Spontaneous) 주문 슬롯 복구
			// 아이템이 속한 주문서(Entry)가 자발적 시전 타입이면, 해당 레벨의 슬롯을 회복
			if (item.type === "spell") {
				const entryId = item.system.location?.value;
				const entry = actor.spellcasting?.get(entryId);
				// 아이템의 레벨 (Rank)
				const rank = item.rank || item.system.level?.value;

				if (entry && entry.isSpontaneous && rank > 0) {
					const slotKey = `slot${rank}`;
					const slotData = entry.system.slots?.[slotKey];
					if (slotData && slotData.max > 0) {
						// 슬롯을 최대로 회복
						await entry.update({ [`system.slots.${slotKey}.value`]: slotData.max });
						return true;
					}
				}
			}
		}

		return false;
	}
}
