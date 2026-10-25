/** ON-SCREEN HELP **/
// Keyboard Shortcuts panel (? key or the ⌨ button), a one-time
// "how to draw" hint over the chart, and a status line showing what a
// click and a drag will do with the current brush and symmetry.

const shortcutsModal = document.getElementById('shortcutsModal');
const drawHint = document.getElementById('drawHint');
const statusLine = document.getElementById('statusLine');

// --- Keyboard Shortcuts panel ---

function toggleShortcuts(show) {
    shortcutsModal.classList.toggle('hidden', !show);
}

document.getElementById('shortcutsBtn').addEventListener('click', () => toggleShortcuts(true));
document.getElementById('closeShortcuts').addEventListener('click', () => toggleShortcuts(false));
document.getElementById('closeShortcutsBtn').addEventListener('click', () => toggleShortcuts(false));
shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) toggleShortcuts(false);  // click outside the box
});

window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;

    if (e.key === '?') {
        toggleShortcuts(shortcutsModal.classList.contains('hidden'));
        e.preventDefault();
    } else if (e.key === 'Escape' && !shortcutsModal.classList.contains('hidden')) {
        toggleShortcuts(false);
    }
});

// --- Toolbar menus: Draw (brush, symmetry, colors, fill) and Display ---
// One open at a time; a click outside or Esc closes it.

const toolbarMenus = [
    { btn: document.getElementById('drawMenuBtn'), menu: document.getElementById('drawMenu') },
    { btn: document.getElementById('displayMenuBtn'), menu: document.getElementById('displayMenu') },
];

function toggleMenu(entry, show) {
    entry.menu.classList.toggle('hidden', !show);
    entry.btn.setAttribute('aria-expanded', show);
}
const menuOpen = (entry) => !entry.menu.classList.contains('hidden');
function closeMenus() { toolbarMenus.forEach(m => toggleMenu(m, false)); }

toolbarMenus.forEach(entry => {
    entry.btn.addEventListener('click', () => {
        const show = !menuOpen(entry);
        closeMenus();
        toggleMenu(entry, show);
    });
});
// Close on a click anywhere outside the open menu and its button
document.addEventListener('mousedown', (e) => {
    toolbarMenus.forEach(entry => {
        if (menuOpen(entry) && !entry.menu.contains(e.target) && !entry.btn.contains(e.target)) {
            toggleMenu(entry, false);
        }
    });
});
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenus();
});

// Kept for callers and tests that used the Display-only version
function toggleDisplayMenu(show) { toggleMenu(toolbarMenus[1], show); }

// --- One-time drawing hint ---
// Shown until the user dismisses it or makes their first edit;
// remembered in this browser (if storage is available).

const HINT_KEY = 'moyaDrawHintDismissed';

function hintDismissed() {
    try { return localStorage.getItem(HINT_KEY) === '1'; } catch (e) { return false; }
}

function dismissDrawHint() {
    drawHint.classList.add('hidden');
    try { localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* not remembered */ }
}

document.getElementById('drawHintClose').addEventListener('click', dismissDrawHint);
if (!hintDismissed()) drawHint.classList.remove('hidden');

// Called by recordUndo() whenever the chart is about to be edited
function onChartEdited() {
    if (!drawHint.classList.contains('hidden')) dismissDrawHint();
}

// --- Status line ---

function updateStatusLine() {
    const { size } = brushSpan();
    const sym = symSelect.options[symSelect.selectedIndex].text.trim();
    const symText = symSelect.value === 'none' ? 'No symmetry' : `Symmetry: ${sym}`;
    const sep = '<span class="status-sep">|</span>';
    const swatch = (input) => `<span class="status-swatch" style="background:${input.value}"></span>`;

    let tool;
    if (drawTool === 'toggle') {
        tool = `<b>Toggle mode</b>${sep}Click flips a stitch between A and B${sep}` +
               `Drag sets stitches to the color the first one flips to`;
    } else {
        const [me, other] = drawTool === 'A' ? ['A', 'B'] : ['B', 'A'];
        const meInput = drawTool === 'A' ? colorAInput : colorBInput;
        tool = `<b>Color ${me}</b> ${swatch(meInput)}${sep}Click or drag sets stitches to Color ${me}${sep}` +
               `<b>Alt</b> for Color ${other}`;
    }

    // Left: what drawing does now. Right: how to move around the chart.
    statusLine.innerHTML =
        `<span class="status-main"><span class="status-label">Drawing</span>${tool}${sep}` +
        `Brush ${size}&times;${size} stitch${size > 1 ? 'es' : ''}${sep}${symText}</span>` +
        `<span class="status-nav"><span class="status-label">View</span>` +
        `<b>Wheel</b> or <b>I</b>/<b>O</b> zoom${sep}<b>Space</b>+drag pans${sep}` +
        `<b>F</b> fits${sep}<b>?</b> shortcuts</span>`;
}

// Keep the Color A / Color B swatches in the current palette colors
function updateToolSwatches() {
    document.getElementById('toolSwatchA').style.background = colorAInput.value;
    document.getElementById('toolSwatchB').style.background = colorBInput.value;
}

// Reset to white/black only does something once a color has changed
function updateResetPaletteBtn() {
    resetPaletteBtn.disabled = colorAInput.value.toLowerCase() === '#ffffff' &&
                               colorBInput.value.toLowerCase() === '#000000';
}

function onPaletteChange() {
    updateToolSwatches();
    updateResetPaletteBtn();
    updateStatusLine();
}

brushSlider.addEventListener('input', updateStatusLine);
symSelect.addEventListener('change', updateStatusLine);
colorAInput.addEventListener('input', onPaletteChange);
colorBInput.addEventListener('input', onPaletteChange);
// Swap/Reset Palette set the colors directly, without an input event
swapPaletteBtn.addEventListener('click', onPaletteChange);
resetPaletteBtn.addEventListener('click', onPaletteChange);
onPaletteChange();
