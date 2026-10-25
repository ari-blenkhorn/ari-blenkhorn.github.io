/** ON-SCREEN HELP **/
// Keyboard Shortcuts panel (? key or the ? button), User's Guide
// (U key or the book button), a one-time
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

// --- User's Guide ---
// Opened with the U key, the book button in the sidebar, and links in the
// welcome note, shortcuts list, and About box (anything with data-open-guide).

const guideModal = document.getElementById('guideModal');

function toggleGuide(show) {
    guideModal.classList.toggle('hidden', !show);
}

document.querySelectorAll('[data-open-guide]').forEach(el => {
    el.addEventListener('click', () => {
        toggleShortcuts(false);
        toggleAbout(false);
        if (el.closest('#drawHint')) dismissDrawHint();
        toggleGuide(true);
    });
});
document.getElementById('closeGuide').addEventListener('click', () => toggleGuide(false));
document.getElementById('closeGuideBtn').addEventListener('click', () => toggleGuide(false));
guideModal.addEventListener('click', (e) => {
    if (e.target === guideModal) toggleGuide(false);  // click outside the box
});
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !guideModal.classList.contains('hidden')) toggleGuide(false);

    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyU') {
        toggleShortcuts(false);
        toggleAbout(false);
        toggleGuide(guideModal.classList.contains('hidden'));
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

// --- Welcome note ---
// Shown each time the page loads, until the user dismisses it or makes
// their first edit. (MoYa starts with a fresh chart on every load, so
// the note comes back with it.) "Never show this again" turns it off in
// this browser; Reset All Settings & Workspace turns it back on.

const WELCOME_OFF_KEY = 'moyaWelcomeNeverShow';
const drawHintNever = document.getElementById('drawHintNever');

function dismissDrawHint() {
    drawHint.classList.add('hidden');
}

function welcomeTurnedOff() {
    try { return localStorage.getItem(WELCOME_OFF_KEY) === '1'; } catch (e) { return false; }
}

drawHintNever.addEventListener('change', () => {
    try {
        if (drawHintNever.checked) localStorage.setItem(WELCOME_OFF_KEY, '1');
        else localStorage.removeItem(WELCOME_OFF_KEY);
    } catch (e) { /* not remembered */ }
});

document.getElementById('drawHintClose').addEventListener('click', dismissDrawHint);
if (!welcomeTurnedOff()) drawHint.classList.remove('hidden');
// Earlier versions remembered the dismissal in this browser; clean that up
try { localStorage.removeItem('moyaDrawHintDismissed'); } catch (e) { /* no storage */ }

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
        tool = `<b>Toggle mode</b>${sep}Click flips A/B${sep}Drag paints the first flip's color`;
    } else {
        const [me, other] = drawTool === 'A' ? ['A', 'B'] : ['B', 'A'];
        const meInput = drawTool === 'A' ? colorAInput : colorBInput;
        tool = `<b>Color ${me}</b> ${swatch(meInput)}${sep}Click/drag paints ${me}${sep}<b>Alt</b> paints ${other}`;
    }

    // Left: what drawing does now. Right: how to move around the chart.
    statusLine.innerHTML =
        `<span class="status-main"><span class="status-label">Drawing</span>${tool}${sep}` +
        `Brush ${size}&times;${size}${sep}${symText}</span>` +
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
