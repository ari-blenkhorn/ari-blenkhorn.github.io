/** UNDO / REDO **/
// Each history entry is a snapshot of the chart taken just before an edit:
// the drawing layer's pixels and size and the applied gauge, plus the
// background layer for edits that change it (loading, resizing, cropping).
// Background images can be large, so other edits don't copy it.
// A whole click-and-drag stroke is one entry.

const UNDO_LIMIT = 50;
const undoStack = [];
const redoStack = [];

const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

function captureState(includeBg) {
    const w = drawCanvas.width, h = drawCanvas.height;
    const state = {
        w, h,
        draw: (w && h) ? drawCtx.getImageData(0, 0, w, h) : null,
        gauge: { pph: appliedGauge().pph, ppv: appliedGauge().ppv },
    };
    if (includeBg) {
        const bw = bgCanvas.width, bh = bgCanvas.height;
        state.bg = { w: bw, h: bh, data: (bw && bh) ? bgCtx.getImageData(0, 0, bw, bh) : null };
    }
    return state;
}

// Call just before changing the chart. label names the edit in the
// Undo/Redo tooltips; bg: true if the edit also changes the background.
function recordUndo(label, { bg = false } = {}) {
    if (!drawCanvas.width) return;
    const state = captureState(bg);
    state.label = label;
    undoStack.push(state);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack.length = 0;
    updateUndoButtons();
}

function restoreState(state) {
    const box = chartScreenBox();
    const wasValidated = !!validationStats;
    const sizeChanged = state.w !== drawCanvas.width || state.h !== drawCanvas.height;

    // Drawing and display layers (resizing a canvas clears it)
    drawCanvas.width = displayCanvas.width = state.w;
    drawCanvas.height = displayCanvas.height = state.h;
    if (state.draw) drawCtx.putImageData(state.draw, 0, 0);

    if (state.bg) {
        bgCanvas.width = state.bg.w;
        bgCanvas.height = state.bg.h;
        if (state.bg.data) bgCtx.putImageData(state.bg.data, 0, 0);
    }

    // Applied gauge, shown in the gauge fields too
    pp4hInput.dataset.oldGauge = state.gauge.pph;
    pp4vInput.dataset.oldGauge = state.gauge.ppv;
    pp4hInput.value = state.gauge.pph * 4;
    pp4vInput.value = state.gauge.ppv * 4;
    updateGaugeDisplay();

    activePixel = null;
    validationOutput = [];
    validationStats = null;

    // Keep the chart's on-screen size if its resolution changed
    if (sizeChanged || state.bg) keepApparentSize(box);
    updateResizeInputs();

    setDirty(true);
    setDownloadsAllowed(true);
    if (wasValidated) validateBtn.click();
    render();
    updateStatusWindow();
}

function undo() {
    const state = undoStack.pop();
    if (!state) return;
    const current = captureState(!!state.bg);
    current.label = state.label;
    redoStack.push(current);
    restoreState(state);
    updateUndoButtons();
}

function redo() {
    const state = redoStack.pop();
    if (!state) return;
    const current = captureState(!!state.bg);
    current.label = state.label;
    undoStack.push(current);
    restoreState(state);
    updateUndoButtons();
}

// Forget all history (e.g. after Reset All Settings & Workspace)
function clearUndoHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    updateUndoButtons();
}

function updateUndoButtons() {
    const u = undoStack[undoStack.length - 1];
    const r = redoStack[redoStack.length - 1];
    undoBtn.disabled = !u;
    redoBtn.disabled = !r;
    undoBtn.title = u ? `Undo ${u.label} (Ctrl+Z)` : 'Nothing to undo (Ctrl+Z)';
    redoBtn.title = r ? `Redo ${r.label} (Ctrl+Y or Ctrl+Shift+Z)` : 'Nothing to redo (Ctrl+Y or Ctrl+Shift+Z)';
}

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

// Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z (Cmd on a Mac). Typing in a text or
// number field keeps the browser's own undo for that field.
window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'color'].includes(t.type)) || t.tagName === 'TEXTAREA')) return;

    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});

updateUndoButtons();
