/**
 * SF2E STYLISH BRIDGE — Set Checks Color Macro
 * 
 * Instructions:
 * 1. Create a new Macro in Foundry VTT (Type: Script).
 * 2. Paste this entire code into the macro editor.
 * 3. Run the macro to open the color picker dialog.
 */

(async () => {
    const DEFAULT_COLOR = "#c084fc";
    const PALETTE = ["#c084fc", "#4a6ea2", "#ff4500", "#05FF00", "#F3E600", "#FF00FF"];
    
    // Helper: Hex to RGB string
    const hexToRgb = (hex) => {
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
    };

    // Apply function logic
    const applyColor = async (hex) => {
        await game.settings.set("stylish-bridge-sf2e", "checksColor", hex);
        const rgb = hexToRgb(hex);
        document.documentElement.style.setProperty('--sf2e-checks-color', hex);
        if (rgb) document.documentElement.style.setProperty('--sf2e-checks-color-rgb', rgb);
        ui.notifications.info(`SF2E Bridge | Bonus color set to ${hex}`);
    };

    const currentColor = game.settings.get("stylish-bridge-sf2e", "checksColor") || DEFAULT_COLOR;

    const content = `
    <div style="display:flex; flex-direction:column; gap:15px; font-family:'Oswald', sans-serif;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <label>Pick a Color:</label>
            <input type="color" id="sf2e-color-picker" value="${currentColor}" style="width:50px; height:30px; cursor:pointer; border:none; background:none;">
        </div>

        <div>
            <label style="display:block; margin-bottom:8px;">Quick Palette:</label>
            <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:6px;">
                ${PALETTE.map(c => `
                    <div class="sf2e-swatch" data-color="${c}" style="
                        background:${c}; height:25px; border-radius:4px; cursor:pointer; 
                        border: 2px solid ${c === currentColor ? '#fff' : 'rgba(255,255,255,0.1)'};
                    "></div>
                `).join("")}
            </div>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <label>Hex Code:</label>
            <input type="text" id="sf2e-color-text" value="${currentColor}" style="width:100px; text-align:center; background:#111; color:#fff; border:1px solid #444; border-radius:4px;">
        </div>
    </div>

    <script>
        // Handle interactive UI
        const picker = document.getElementById('sf2e-color-picker');
        const text = document.getElementById('sf2e-color-text');
        const swatches = document.querySelectorAll('.sf2e-swatch');

        picker.addEventListener('input', (e) => {
            text.value = e.target.value.toUpperCase();
            swatches.forEach(s => s.style.borderColor = 'rgba(255,255,255,0.1)');
        });

        text.addEventListener('input', (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                picker.value = e.target.value;
            }
        });

        swatches.forEach(s => {
            s.addEventListener('click', () => {
                const color = s.dataset.color;
                picker.value = color;
                text.value = color.toUpperCase();
                swatches.forEach(sw => sw.style.borderColor = 'rgba(255,255,255,0.1)');
                s.style.borderColor = '#fff';
            });
        });
    </script>
    `;

    const { DialogV2 } = foundry.applications.api;
    const dialog = new DialogV2({
        window: { title: "Set Checks Bonus Color", icon: "fas fa-palette" },
        content: content,
        buttons: [
            {
                action: "apply",
                label: "Apply",
                icon: "fas fa-check",
                callback: (event, target) => {
                    const hex = document.getElementById('sf2e-color-text').value;
                    applyColor(hex);
                }
            },
            {
                action: "reset",
                label: "Reset to Default",
                icon: "fas fa-undo",
                callback: () => applyColor(DEFAULT_COLOR)
            },
            {
                action: "close",
                label: "Cancel",
                icon: "fas fa-times"
            }
        ]
    });
    dialog.render(true);
})();