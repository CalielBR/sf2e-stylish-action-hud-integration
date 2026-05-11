/**
 * journal-log.js
 * Gerencia o Journal de log de transações da loja SF2e.
 *
 * Fluxo para não-GMs:
 *  - Se o GM estiver online, emite um socket "sf2e-bridge.logTransaction" e
 *    o GM escreve a entrada no journal.
 *  - Se nenhum GM estiver online, a entrada é silenciosamente descartada
 *    (comportamento anterior mantido — não há como criar/editar journals sem GM).
 *
 * Registre o handler de socket em main.js (uma única vez, no hook "ready"):
 *   import { registerJournalSocketHandler } from "./journal-log.js";
 *   Hooks.once("ready", registerJournalSocketHandler);
 */

import { warnAlert } from "./debug-utils.js";

const JOURNAL_NAME  = "Shop — Transaction Log";
const SOCKET_EVENT  = "module.stylish-bridge-sf2e";
const MAX_ENTRIES   = 200;

// ---------------------------------------------------------------------------
// Socket handler — deve ser registrado pelo GM (e apenas pelo GM)
// ---------------------------------------------------------------------------

/**
 * Registra o listener de socket que permite não-GMs delegar a escrita do log.
 * Chame isto uma vez no hook "ready" de main.js.
 */
export function registerJournalSocketHandler() {
    game.socket.on(SOCKET_EVENT, async (payload) => {
        if (payload?.action !== "logTransaction") return;
        if (!game.user.isGM) return; // só o GM processa

        await _writeTransactionLog(payload.data);
    });
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Obtém ou cria o JournalEntry público de log de transações.
 * Só pode criar se o usuário for GM.
 * @returns {Promise<JournalEntry|null>}
 */
export async function getOrCreateShopJournal() {
    try {
        const enabled = game.settings.get("stylish-bridge-sf2e", "enableShopLog");
        if (!enabled) return null;
    } catch {
        // Setting pode não existir ainda durante init — continua
    }

    let journal = game.journal.find(j => j.name === JOURNAL_NAME);
    if (journal) return journal;

    if (!game.user.isGM) return null;

    journal = await JournalEntry.create({
        name: JOURNAL_NAME,
        ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
    });

    await journal.createEmbeddedDocuments("JournalEntryPage", [{
        name: "Histórico de Transações",
        type: "text",
        text: {
            content: `<p><em>Nenhuma transação registrada ainda.</em></p>`,
            format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,
        }
    }]);

    return journal;
}

/**
 * Adiciona uma linha de transação ao Journal de log.
 * Se o usuário atual não for GM, delega a escrita ao GM via socket.
 *
 * @param {Object} opts
 * @param {string} opts.actorName
 * @param {string} opts.type       - "COMPRA" ou "VENDA"
 * @param {string} opts.itemName
 * @param {number} opts.qty
 * @param {number} opts.credits
 * @param {number} opts.balanceAfter
 */

export async function appendTransactionLog({ actorName, type, itemName, qty, credits, balanceAfter }) {
    try {
        const enabled = game.settings.get("stylish-bridge-sf2e", "enableShopLog");
        if (!enabled) return;
    } catch {
        return;
    }

    const data = { actorName, type, itemName, qty, credits, balanceAfter };

    if (game.user.isGM) {
        // GM escreve diretamente
        await _writeTransactionLog(data);
    } else {
        // Não-GM: verifica se há algum GM conectado antes de emitir o socket
        const gmOnline = game.users.some(u => u.isGM && u.active);
        if (!gmOnline) {
            await warnAlert({
                message: "TRANSACTION LOG DISCARDED",
                details: [
                    `<strong>SUBJECT:</strong> ${data.actorName}`,
                    `<strong>REASON:</strong> No GM online to write the journal entry`,
                    `<strong>ITEM:</strong> ${data.itemName} ×${data.qty}`,
                ],
            });
            return;
        }
        game.socket.emit(SOCKET_EVENT, { action: "logTransaction", data });
    }
}

// ---------------------------------------------------------------------------
// Implementação interna — só chamada por quem tem permissão de GM
// ---------------------------------------------------------------------------

/**
 * Escreve de fato a entrada no journal. Deve ser chamado somente pelo GM.
 * @param {Object} data
 */
async function _writeTransactionLog({ actorName, type, itemName, qty, credits, balanceAfter }) {
    const journal = await getOrCreateShopJournal();
    if (!journal) return;

    const page = journal.pages.contents[0];
    if (!page) return;

    const date      = new Date().toLocaleString("pt-BR");
    const typeColor = type === "COMPRA" ? "#4ade80" : "#facc15";
    const typeIcon  = type === "COMPRA" ? "🛒" : "💰";

    const newRow = `
<p style="font-family:monospace; font-size:0.9em; border-bottom:1px solid #333; padding:2px 0; margin:2px 0;">
  <span style="color:#888;">[${date}]</span>
  <span style="color:${typeColor}; font-weight:bold;"> ${typeIcon} ${type}</span>
  — <strong>${actorName}</strong>:
  <em>${itemName}</em> ×${qty}
  | <span style="color:#f87171;">${credits} cr</span>
  | Saldo: <span style="color:#60a5fa;">${balanceAfter} cr</span>
</p>`;

    const currentContent = page.text?.content ?? "";

    // Remove o placeholder inicial se ainda existir
    const cleaned = currentContent.replace(/<p><em>Nenhuma transação registrada ainda\.<\/em><\/p>/, "");

    // Mantém apenas as últimas (MAX_ENTRIES - 1) para adicionar a nova no topo
    const entries = cleaned.match(/<p>[\s\S]*?<\/p>/g) ?? [];
    const trimmed = entries.slice(0, MAX_ENTRIES - 1).join("\n");

    await page.update({
        "text.content": newRow + "\n" + trimmed,
    });
}