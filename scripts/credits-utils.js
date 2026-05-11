import { warnAlert } from "./debug-utils.js";

/**
 * Lê o saldo atual de créditos de um ator.
 * @param {Actor} actor
 * @returns {number}
 */
export function readCredits(actor) {
  return Number(actor.inventory?.coins?.credits ?? 0);
}

/**
 * Resolve qual caminho de dado existe no actor.system para créditos.
 * Retorna "coins" (sistema sf2e padrão), "flat" (fallback legado) ou null.
 * @param {Actor} actor
 * @returns {"coins"|"flat"|null}
 */
function resolveCreditsPath(actor) {
  if (actor.system?.currency?.coins?.credits !== undefined) return "coins";
  if (actor.system?.currency?.credits !== undefined) return "flat";
  return null;
}

/**
 * Deduz créditos de um ator usando o melhor método disponível.
 * @param {Actor} actor
 * @param {number} amount
 */
export async function deductCredits(actor, amount) {
  if (amount <= 0) return;

  // Método nativo do sistema sf2e — preferencial
  if (typeof actor.inventory?.removeCoins === "function") {
    await actor.inventory.removeCoins({ credits: amount });
    return;
  }

  const path = resolveCreditsPath(actor);
  if (!path) {
    await warnAlert({
      message: "CREDITS PATH NOT FOUND",
      details: [
        `<strong>SUBJECT:</strong> ${actor.name}`,
        `<strong>ACTION:</strong> deductCredits`,
        `<strong>DETAIL:</strong> No credits field found in actor.system`,
      ],
      actor,
    });
    return;
  }

  const current = readCredits(actor);
  const newVal  = Math.max(0, current - amount);
  const updateKey = path === "coins"
    ? "system.currency.coins.credits"
    : "system.currency.credits";

  try {
    await actor.update({ [updateKey]: newVal });
  } catch (err) {
    await warnAlert({
      message: "CREDITS UPDATE FAILED",
      details: [
        `<strong>SUBJECT:</strong> ${actor.name}`,
        `<strong>ACTION:</strong> deductCredits`,
        `<strong>ERROR:</strong> ${err?.message ?? err}`,
      ],
      actor,
    });
  }
}

/**
 * Adiciona créditos a um ator.
 * @param {Actor} actor
 * @param {number} amount
 */
export async function addCredits(actor, amount) {
  if (amount <= 0) return;

  // Método nativo do sistema sf2e — preferencial
  if (typeof actor.inventory?.addCoins === "function") {
    await actor.inventory.addCoins({ credits: amount });
    return;
  }

  const path = resolveCreditsPath(actor);
  if (!path) {
    await warnAlert({
      message: "CREDITS PATH NOT FOUND",
      details: [
        `<strong>SUBJECT:</strong> ${actor.name}`,
        `<strong>ACTION:</strong> addCredits`,
        `<strong>DETAIL:</strong> No credits field found in actor.system`,
      ],
      actor,
    });
    return;
  }

  const current = readCredits(actor);
  const newVal  = current + amount;
  const updateKey = path === "coins"
    ? "system.currency.coins.credits"
    : "system.currency.credits";

  try {
    await actor.update({ [updateKey]: newVal });
  } catch (err) {
    await warnAlert({
      message: "CREDITS UPDATE FAILED",
      details: [
        `<strong>SUBJECT:</strong> ${actor.name}`,
        `<strong>ACTION:</strong> addCredits`,
        `<strong>ERROR:</strong> ${err?.message ?? err}`,
      ],
      actor,
    });
  }
}