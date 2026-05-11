/**
 * SF2E Bridge | Debug Utility
 * Centralized logging that respects the 'Debug Mode' setting.
 */
export function debugLog(...args) {
    try {
        if (game.settings.get("stylish-bridge-sf2e", "debugMode")) {
            console.log("%c SF2E Bridge | DEBUG |", "color: #c084fc; font-weight: bold;", ...args);
        }
    } catch (e) {
        // Fallback safe: settings might not be ready during init
        console.log("SF2E Bridge |", ...args);
    }
}

/**
 * Emite um warn amarelo no console com o mesmo prefixo estilizado do debugLog,
 * E lança um ChatMessage com o CSS idêntico ao alerta de créditos insuficientes do módulo.
 *
 * Console output:
 *   %c SF2E Bridge | DEBUG |  (amarelo bold)  Shop | Buy failed: insufficient credits for "X"
 *
 * @param {Object} opts
 * @param {string}   opts.message   - Mensagem curta (ex: `Shop | Buy failed: insufficient credits for "Item"`).
 * @param {string[]} [opts.details] - Linhas de detalhe no bloco interno do card (suportam HTML simples).
 * @param {string}   [opts.icon]    - Emoji no canto superior direito. Padrão: "☣️"
 * @param {Actor}    [opts.actor]   - Ator falante. Usa speaker genérico se omitido.
 */
export async function warnAlert({
    message,
    details = [],
    icon    = "☣️",
    actor   = null,
} = {}) {
    // ── 1. console.warn amarelo — mesmo estilo do debugLog, mas em warn ──────
    console.warn(
        "%c SF2E Bridge | DEBUG |",
        "color: #facc15; font-weight: bold;",
        message,
    );

    // ── 2. ChatMessage — CSS idêntico ao alerta de créditos insuficientes ────
    const detailsHtml = details.map(line => `${line}<br>`).join("");

    const content = `
<div style="background: #000; color: #facc15; border: 2px solid #facc15; padding: 12px; font-family: 'Share Tech Mono', 'Courier New', monospace; box-shadow: 0 0 8px #facc15 inset; position: relative; border-radius: 0;">
    <div style="position: absolute; top: 2px; right: 5px; font-size: 1.8em; opacity: 0.9; color: #facc15;">${icon}</div>
    <strong style="display: block; border-bottom: 1px solid #facc15; margin-bottom: 8px; font-size: 1.2em; letter-spacing: 2px;">[ SYSTEM ALERT ]</strong>
    <div style="line-height: 1.4;">
        <div style="color: #ff4444; font-weight: bold; font-size: 1.2em; margin-bottom: 5px;">${message}</div>
        ${detailsHtml ? `
        <div style="font-size: 1.0em;">
            <div style="margin-top: 5px; border: 1px solid rgba(250, 204, 21, 0.3); padding: 5px; background: rgba(255, 0, 0, 0.1);">
                ${detailsHtml}
            </div>
        </div>` : ""}
    </div>
</div>`;

    try {
        await ChatMessage.create({
            speaker: actor
                ? ChatMessage.getSpeaker({ actor })
                : ChatMessage.getSpeaker(),
            content,
        });
    } catch (err) {
        console.error("SF2E Bridge | warnAlert: falha ao criar ChatMessage:", err);
    }
}