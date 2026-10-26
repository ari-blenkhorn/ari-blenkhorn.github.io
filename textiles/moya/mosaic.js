/** GLOBALS & STATE **/

const dropZone = document.querySelector('.editor-container');
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const upload = document.getElementById('upload');
const downloadImgBtn = document.getElementById('downloadImgBtn');
const downloadChartImgBtn = document.getElementById('downloadChartImgBtn');
const downloadChartPDFBtn = document.getElementById('downloadChartPDFBtn');
const validateBtn = document.getElementById('validateBtn');
const resetBtn = document.getElementById('resetView');
const revertBtn = document.getElementById('revertBtn');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');
const gridToggle = document.getElementById('showGrid');
const subGridToggle = document.getElementById('showSubGrid');
const physicalRulersToggle = document.getElementById('showPhysicalRulers');
const firstRowAToggle = document.getElementById('firstRowA');
const validationErrorToggle = document.getElementById('showErrors');
const brushSlider = document.getElementById('brushSize');
const brushValDisplay = document.getElementById('brushVal');
const createNewBtn = document.getElementById('createNewBtn');
const unitSelect = document.getElementById('unitSelect');
const gaugeControls = document.getElementById('gaugeControls');
const pp4hInput = document.getElementById('pp4h'); // stitches per 4 inches
const pp4vInput = document.getElementById('pp4v'); // rows per 4 inches
const factoryResetBtn = document.getElementById('factoryResetBtn');
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const openSidebarBtn = document.getElementById('openSidebar');
const fullscreenBtn = document.getElementById('toggleFullscreen');
const symSelect = document.getElementById('symmetryMode');


// --- Define Default Values for UI / Workspace reset ---
const DEFAULTS = {
    pp4h: 20,
    pp4v: 20,
    newW: 80,
    newH: 60,
    newUnit: 'px',
    thresholdRange: 128,
    brushSize: 1,
    showGrid: true,
    showSubGrid: true,
    showphysicalRulersToggleRulers: false,
    firstRowA: false,
    showErrors: true,
	showChartMarkings: true
};

// --- Global Variables ---
let viewState = { x: 0, y: 0, scale: 1 };
let isPanning = false;
let lastMouse = { x: 0, y: 0 }; // Track position for delta panning
let spacePressed = false;
let img = null; 
let originalImg = null; // to store the clean Image object, for reverting
// Size (stitches x rows) when the chart was created or an image was loaded.
// Unlike originalImg, resizing doesn't change it ("Reset to Original").
let originalSize = null;
let activePixel = null;  // Stores {raw (x,y), display (x,y), rgba}
let validationOutput = []; // Array of {x, y} coordinates that failed or have markings
let mouseImagePos = { x: null, y: null };
let validationStats = null;
let vStatsDirty = false;

// Offscreen layers
/*
bgCanvas: Holds the fixed Background Layer (Original colors).
drawCanvas: Holds the Drawing Layer (Black/White source data).
   All pixel clicks, thresholds, and validation happen here.
displayCanvas: A temporary buffer used only for the Tinted View
   Apply the 2-color palette (yarn colors) to the drawing layer for display.
   Grids and rulers go here.
*/

const bgCanvas = document.createElement('canvas');
const bgCtx = bgCanvas.getContext('2d', { willReadFrequently: true });
const drawCanvas = document.createElement('canvas');
const drawCtx = drawCanvas.getContext('2d', { willReadFrequently: true });
const displayCanvas = document.createElement('canvas')
const displayCtx = displayCanvas.getContext('2d', { willReadFrequently: true });

let isDirty = false;

/** 1. INITIALIZATION & UPLOAD **/

/** "Reset Everything" Logic **/
function resetToFactoryDefaults() {
    // A. Remove the saved workspace from the browser
    localStorage.removeItem('imgEditorWorkspace');
    // ...and show the welcome note again next time
    localStorage.removeItem('moyaWelcomeNeverShow');

    // B. Wipe the current image and canvases
    clearWorkspace();

    // C. Reset every UI element to its default state
    Object.keys(DEFAULTS).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = DEFAULTS[id];
            } else {
                el.value = DEFAULTS[id];
            }
            // Trigger 'input' or 'change' events to update labels (like threshold number)
            el.dispatchEvent(new Event('input'));
            el.dispatchEvent(new Event('change'));
        }
    });

    // D. Specific UI cleanup
    gaugeControls.style.display = 'none';
    updateGaugeDisplay();

    // E. Nothing to undo in a fresh workspace
    clearUndoHistory();

    alert("Settings and Workspace have been reset to factory defaults.");
    render();
}

/** Event Listener for "Reset Everything" **/
factoryResetBtn.addEventListener('click', () => {
    if (confirm("This will delete your saved workspace and reset all sliders/toggles. Continue?")) {
        resetToFactoryDefaults();
    }
});


// Show/Hide pixels-per-inch controls based on unit selection
unitSelect.addEventListener('change', () => {
    gaugeControls.style.display = unitSelect.value === 'in' ? 'block' : 'none';
});
// Update the visible gauge calculation
function updateGaugeDisplay() {
    const pph = parseFloat(pp4hInput.value) / 4;
    const ppv = parseFloat(pp4vInput.value) / 4;

    if (!isNaN(pph) && !isNaN(ppv)) {
        gaugeDisplay.innerText = `Per inch: ${pph.toFixed(1)} stitches x ${ppv.toFixed(1)} rows`;
    }
}

// Listen for changes to the 4-inch inputs
pp4hInput.addEventListener('input', updateGaugeDisplay);
pp4vInput.addEventListener('input', updateGaugeDisplay);


function createNewImage(w, h) {
    recordUndo('new chart');  // no-op when there's no chart yet

    // 1. Setup Offscreen Canvas
    drawCanvas.width = w;
    drawCanvas.height = h;

    // 2. Fill with ColorA (default white)
    drawCtx.fillStyle = colorAInput.value;
    drawCtx.fillRect(0, 0, w, h);

    // 3. Create a dummy "original" for the Revert function
    // We create a new Image object from the white canvas
    const dataURL = drawCanvas.toDataURL();
    const tempImg = new Image();
    tempImg.onload = () => {
        img = tempImg;
        originalImg = tempImg;
        originalSize = { w, h };

        // 4. Reset States
        activePixel = null;
        validationOutput = [];
		//alert("setDirty(false) and setDownloadsAllowed(false) in createNewImage");
        setDirty(false);
        setDownloadsAllowed(false);
        resetView();
		updateResizeInputs();
		updateGaugeReference();
        render();

		// if the user has specified the image size unit as "Inches"
		// show physical size AND pixels

		if (unitSelect.value === 'in') {
			// Calculate current gauge from the 4-inch inputs
			const pph = parseFloat(document.getElementById('pp4h').value) / 4;
			const ppv = parseFloat(document.getElementById('pp4v').value) / 4;

			// Calculate Inches
			const inchW = (w / pph).toFixed(2);
			const inchH = (h / ppv).toFixed(2);
			status.innerHTML = `Created New Image: ${inchW}" x ${inchH}"  (${w} x ${h} pixels)`;
			console.log( `Created New Image: ${inchW}" x ${inchH}"  (${w} x ${h} pixels)`);
		}
		else {
			status.innerHTML = `Created New Image: ${w} x ${h} px`;
			console.log(`Created New Image: ${w} x ${h} px`);
		}
    };
    tempImg.src = dataURL;
}
function clearWorkspace() {
    // 1. Reset Global State
    img = null;
    originalImg = null;
    originalSize = null;
    activePixel = null;
    validationOutput = [];
    isDirty = false;
	validationStats = null; 

    // 2. Wipe Canvases
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
	bgCanvas.width = 0;
    bgCanvas.height = 0;
    
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    drawCanvas.width = 0;
    drawCanvas.height = 0;

    displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    displayCanvas.width = 0;
    displayCanvas.height = 0;
	
	// Make fresh blank drawing canvas
	setTargetDimensions(DEFAULTS['newW'], DEFAULTS['newH'], DEFAULTS['newUnit']);
	const el = document.getElementById('btnNew');
	el.dispatchEvent(new Event('click'));

    // 3. Reset UI Elements
	
    // Clear file inputs
	document.getElementById('uploadFront').value = ""; 
    document.getElementById('uploadBack').value = "";
    
	status.innerHTML = "Waiting for image...";

    // 4. Disable Buttons
	//alert("setDownloadsAllowed(true) in clearWorkspace");

    setDownloadsAllowed(false);

    revertBtn.disabled = true;
    clearBtn.disabled = true;
	//alert("ClearBtn.disabled ---> true in ClearWorkspace");
}

/** 2. Event Listener **/
clearBtn.addEventListener('click', () => {
    if (confirm("Clear all data and start over?")) {
        recordUndo('clear', { bg: true });
        clearWorkspace();
    }
});


// TODO - work on this a little more.
// we want to be able to save the chart even if the source image hasn't been modified
// That's how we get markings, grid lines, etc.
function setDownloadsAllowed(allowed) {
    downloadImgBtn.disabled = !allowed;
    downloadChartImgBtn.disabled = !allowed;
    downloadChartPDFBtn.disabled = !allowed;
	clearBtn.disabled = !allowed;
	//alert("ClearBtn.disabled --->  " + !allowed + " in setDownloadsAllowed");

	// Like download, Clear should be enabled iff there's modified data
}

function handleFile(file, targetLayer = 'drawing') {
    if (!file || !file.type.startsWith('image/')) {
        alert("Please drop a valid image file.");
        return;
    }
	
    const reader = new FileReader();
    reader.onload = (e) => {
        const tempImg = new Image();
        tempImg.onload = () => {
            recordUndo('image load', { bg: true });

			if (targetLayer === 'background') {
				//alert("Loading background layer");
                originalImg = tempImg; // store for Revert
                bgCanvas.width = tempImg.width;
                bgCanvas.height = tempImg.height;
                bgCtx.drawImage(tempImg, 0, 0);
				// if draw/display layers are currently untouched, 
				// size them to match, set to "white", and switch to Trace mode

				drawCanvas.width = displayCanvas.width = tempImg.width;
				drawCanvas.height = displayCanvas.height = tempImg.height;
				drawCtx.imageSmoothingEnabled = false;
					clearTraceToABtn.click();
				
				// Clear the UI's displayed name for draw layer
				uploadFront.value = null;
/*
				// clearTraceToA should handle this
                drawCtx.fillStyle = "#FFFFFF"; // Initial White
                drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
*/

				// UI AUTOMATION: Switch to Trace Mode immediately
                const modeSelect = document.getElementById('viewMode');
                if (modeSelect) {
                    modeSelect.value = 'trace';
                    // Manually trigger the 'change' event to show the Opacity slider
                    modeSelect.dispatchEvent(new Event('change'));

					status.innerHTML = `Loaded Background: ${tempImg.width}x${tempImg.height}px`;
				}
            } else if (targetLayer === 'drawing') {
				//alert("Loading foreground layer");

                // Drawing Layer setup - sync size of display layer too
                drawCanvas.width = displayCanvas.width = tempImg.width;
                drawCanvas.height = displayCanvas.height = tempImg.height;
                drawCtx.drawImage(tempImg, 0, 0);

                // If bg is empty, sync bg size to this new drawing
                if (!bgCanvas.width) {
                    bgCanvas.width = tempImg.width;
                    bgCanvas.height = tempImg.height;
                    bgCtx.fillStyle = "#1a1a1a"; // Dark empty background
                    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
                }
                status.innerHTML = `Loaded Drawing Layer: ${tempImg.width} x ${tempImg.height} px`;

            }
			/*
			else {
				alert("Loading:  unknown layer")
			}
			*/

            originalSize = { w: tempImg.width, h: tempImg.height };
            activePixel = null;
            validationOutput = [];
			validationStats = null;

			//alert("setDirty(true) and setDownloadsAllowed(true) in handleFile");

            setDirty(true); // allow Revert
            setDownloadsAllowed(true);
            resetView(); // center & zoom to fit
			updateResizeInputs();
			updateGaugeReference();
            render();
			updateStatusWindow();
        };
        tempImg.src = e.target.result;
    };
    reader.readAsDataURL(file);

	// AUTO-VALIDATE: Trigger the existing validation logic to refresh red boxes & anchor X's
    // We manually trigger the click event on the validate button
    validateBtn.click();
}

/** 2. Drag & Drop Event Listeners **/
// Prevent default browser behavior (which is opening the image in a new tab)
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

// Toggle the visual "drag-over" class
dropZone.addEventListener('dragenter', () => dropZone.classList.add('drag-over'));
dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

// Handle the dropped file
dropZone.addEventListener('drop', (e) => {
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    handleFile(file, 'drawing');
});

/** 3. Update the layers' Input Listeners to use the same logic **/
uploadFront.addEventListener('change', (e) => {
	//alert("uploadFront");
    handleFile(e.target.files[0], 'drawing');
});

uploadBack.addEventListener('change', (e) => {
	//alert("uploadBack");
    handleFile(e.target.files[0], 'background');
});


/** 2. VIEW CONTROLS (ZOOM/PAN) **/

// --- 1. Keyboard Tracking (for Spacebar Pan) ---
window.addEventListener('keydown', (e) => { 

    // 1. Prevent shortcut if user is typing in an input or textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
	}
    // ...or using a key combination (e.g. Ctrl+V to paste shouldn't validate)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // 2. 'V' Key - Trigger Validation
    if (e.code === 'KeyV') {
        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) {
            validateBtn.click(); // Fires your existing validation & UI logic
            console.log("Validation triggered via 'V' shortcut.");
        }
    }
	// 3. 'H' Key Toggle

	if (e.code === 'KeyH') {
        const isCollapsed = displayRibbon.classList.contains('collapsed');
        toggleRibbon(isCollapsed); // Toggle the opposite state
    }

	// 4. 'T' Key Toggle
    if (e.code === 'KeyT') {
        const modeSelect = document.getElementById('viewMode');

        // If we are already in Trace, go back to Palette
        // Otherwise, switch to Trace
        if (modeSelect.value === 'trace') {
            modeSelect.value = 'palette';
        } else {
            modeSelect.value = 'trace';
        }

        // Trigger the change logic (shows/hides the opacity slider)
        modeSelect.dispatchEvent(new Event('change'));

        // Optional: Brief status message
        console.log(`View Mode toggled to: ${modeSelect.value}`);
    }
	
	// 'F' Key - Fit the chart to the window
    if (e.code === 'KeyF') {
        resetView();
        render();
    }

	// Drawing mode: X = Toggle, A = Color A, B = Color B
    if (e.code === 'KeyX') setDrawTool('toggle');
    if (e.code === 'KeyA') setDrawTool('A');
    if (e.code === 'KeyB') setDrawTool('B');

	// '[' & ']' keys: smaller / larger brush (within the slider's range)
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        const step = e.code === 'BracketRight' ? 1 : -1;
        const min = parseInt(brushSlider.min) || 1, max = parseInt(brushSlider.max) || 10;
        const next = Math.max(min, Math.min(max, (parseInt(brushSlider.value) || 1) + step));
        if (next !== parseInt(brushSlider.value)) {
            brushSlider.value = next;
            brushSlider.dispatchEvent(new Event('input'));  // label, status line
            render();  // resize the preview outline
        }
    }

	// 5. 'I' & 'O' keys for zoom In & Out
    if (e.code === 'KeyI') {
		zoomFromCenter(1.1);
	}
    if (e.code === 'KeyO') {
		zoomFromCenter(0.9);
	}
	
	
	// N. Spacebar toggle
    if(e.code === 'Space') {  // Panning the view
        spacePressed = true;
        updateCanvasCursor();
    }
});
window.addEventListener('keyup', (e) => {
    if(e.code === 'Space') {
        spacePressed = false;
        updateCanvasCursor();
    }
});

// --- 2. Enhanced Zoom (Scales from Center) ---
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!drawCanvas.width) return;

    const factor = Math.pow(1.1, -e.deltaY / 100);
    
	zoomFromCenter(factor);
	
}, { passive: false });

function zoomFromCenter(factor)
{
	// Zoom from the center of the canvas viewport
    const centerX = canvas.clientWidth / 2;  // CSS pixels, like viewState
    const centerY = canvas.clientHeight / 2;
    
    const worldX = (centerX - viewState.x) / viewState.scale;
    const worldY = (centerY - viewState.y) / viewState.scale;

    const newScale = viewState.scale * factor;
    if (newScale > MIN_SCALE && newScale < MAX_SCALE) {
        viewState.scale = newScale;
        viewState.x = centerX - worldX * viewState.scale;
        viewState.y = centerY - worldY * viewState.scale;
    }
    
    render();
}

// --- 3. Panning Logic ---
canvas.addEventListener('mousedown', (e) => {
    if (!drawCanvas.width) return;
    
    // Pan if: Space is held OR Middle Mouse Button is clicked
    if (spacePressed || e.button === 1) {
        isPanning = true;
        updateCanvasCursor();
        lastMouse = { x: e.offsetX, y: e.offsetY };
    } else if (e.button === 0) {
        // Start a possible stroke; the drawing tool picks its color now.
        // If the mouse is released without leaving this stitch, it's a
        // click; see finishStroke()
        const p = eventStitch(e);
        if (stitchInChart(p)) stroke = { start: p, last: p, dragged: false, value: strokeValue(p, e.altKey) };
    }
});

window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;

    // Calculate how far the mouse moved since the last frame
    const dx = e.offsetX - lastMouse.x;
    const dy = e.offsetY - lastMouse.y;

    // Apply that movement to our view
    viewState.x += dx;
    viewState.y += dy;

    // Update last known position for the next move
    lastMouse = { x: e.offsetX, y: e.offsetY };
    render();
});

window.addEventListener('mouseup', () => {
    isPanning = false;
    updateCanvasCursor();
    finishStroke();
});

// Canvas cursor: hand while panning (or ready to pan with Space held),
// "not allowed" over stitches outside the active symmetry region, and a
// crosshair everywhere else
function updateCanvasCursor() {
    let cursor = 'crosshair';
    if (isPanning) cursor = 'grabbing';
    else if (spacePressed) cursor = 'grab';
    else {
        const p = mouseImagePos;
        if (p.x !== null && drawCanvas.width && stitchInChart(p) &&
            !pixelInActiveDrawingArea(p.x, p.y, drawCanvas.width, drawCanvas.height)) {
            cursor = 'not-allowed';
        }
    }
    if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
}
// The active region changes with the symmetry mode
symSelect.addEventListener('change', updateCanvasCursor);


/** 3. PIXEL LOGIC **/

// Click-and-drag drawing with the current tool (see setDrawTool):
//   Toggle:  a click flips the stitch between A and B; a drag paints the
//            color the first stitch flipped to
//   A / B:   a click or drag sets stitches to that color (Alt: the other)
// Moving to another stitch while pressed paints along the path, using
// the brush and symmetry.
let stroke = null; // { start, last, dragged, value } in stitch coordinates

// Drawing layer values: white (255) shows as Color A, black (0) as Color B
const VALUE_A = 255;
const VALUE_B = 0;
const otherValue = (v) => (v === VALUE_A ? VALUE_B : VALUE_A);

function stitchValue(x, y) {
    const p = drawCtx.getImageData(x, y, 1, 1).data;
    return (p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114) >= 128 ? VALUE_A : VALUE_B;
}

// The color a stroke starting on stitch p will paint
function strokeValue(p, altKey) {
    if (drawTool === 'toggle') return otherValue(stitchValue(p.x, p.y));
    const v = drawTool === 'A' ? VALUE_A : VALUE_B;
    return altKey ? otherValue(v) : v;
}

// Current drawing tool: 'toggle', 'A', or 'B'
let drawTool = 'toggle';
const toolButtons = document.querySelectorAll('.tool-btn');

function setDrawTool(tool) {
    drawTool = tool;
    toolButtons.forEach(btn => {
        const on = btn.dataset.tool === tool;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-checked', on);
    });
    if (typeof updateStatusLine === 'function') updateStatusLine();  // help.js
}
toolButtons.forEach(btn => btn.addEventListener('click', () => setDrawTool(btn.dataset.tool)));
// (The A / B tool swatches follow the palette; see help.js)

// Stitch under the mouse. Columns are drawn stretched by the
// non-square-stitch aspect correction.
function eventStitch(e) {
    return {
        x: Math.floor((e.offsetX - viewState.x) / (viewState.scale * aspectCorrectionX())),
        y: Math.floor((e.offsetY - viewState.y) / viewState.scale),
    };
}

function stitchInChart(p) {
    return p.x >= 0 && p.x < drawCanvas.width && p.y >= 0 && p.y < drawCanvas.height;
}

// Extend the stroke to stitch p, painting every stitch along the way
// (Bresenham line) so fast mouse moves don't leave gaps
function continueStroke(p) {
    if (!stroke || (p.x === stroke.last.x && p.y === stroke.last.y)) return;

    if (!stroke.dragged) {
        stroke.dragged = true;
        recordUndo('drawing');  // the whole stroke is one undo step
        paintBrushAt(stroke.start.x, stroke.start.y, stroke.value);
    }

    let { x, y } = stroke.last;
    const dx = Math.abs(p.x - x), sx = x < p.x ? 1 : -1;
    const dy = -Math.abs(p.y - y), sy = y < p.y ? 1 : -1;
    let err = dx + dy;
    while (x !== p.x || y !== p.y) {
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
        paintBrushAt(x, y, stroke.value);
    }
    stroke.last = p;
    render();
}

function finishStroke() {
    if (!stroke) return;
    const s = stroke;
    stroke = null;
    if (s.dragged) finishPixelEdit();  // validate once, at the end of the stroke
    else handlePixelClick(s.start, s.value);
}

// Click: paint the brush area centered on the stitch in value (with the
// Toggle tool, the opposite of what the stitch was)
function handlePixelClick({ x: rawX, y: rawY }, value) {
     if (!drawCanvas.width) return;

    if (stitchInChart({ x: rawX, y: rawY })) {
        const p = drawCtx.getImageData(rawX, rawY, 1, 1).data;
        
        // Update global state
        activePixel = {
            rawX, rawY,
            displayX: (drawCanvas.width - 1) - rawX,
            displayY: (drawCanvas.height - 1) - rawY,
            r: p[0], g: p[1], b: p[2], a: p[3]
        };

        recordUndo(drawTool === 'toggle' ? 'stitch toggle' : 'painting');
        paintBrushAt(rawX, rawY, value);
        activePixel.r = activePixel.g = activePixel.b = value;
        finishPixelEdit();
        render(); // Force a render to update the info box immediately
    }
}


/**  Track Mouse Position for Preview of Brush Effect Region **/
canvas.addEventListener('mousemove', (e) => {
    if (!drawCanvas.width) return;

    // Map screen mouse position to image coordinates
    mouseImagePos = eventStitch(e);
    updateCanvasCursor();

    // Drawing a stroke? (If the button was released outside the window,
    // we never got the mouseup; end the stroke now.)
    if (stroke) {
        if (e.buttons & 1) { continueStroke(mouseImagePos); return; }
        finishStroke();
    }

    // Only re-render if we aren't already panning (panning handles its own render)
    if (!isPanning) render();
});

// Clear preview when mouse leaves canvas
canvas.addEventListener('mouseleave', () => {
    mouseImagePos = { x: null, y: null };
    render();
});

// Update label on brush-size slider
brushSlider.addEventListener('input', () => {
    brushValDisplay.innerText = brushSlider.value;
});

// The stitches a stitch at (x, y) is copied to under the current symmetry
// mode, including (x, y) itself. Stitch x mirrors to (w - 1) - x, so the
// first and last columns pair up. The rotation modes treat the chart as
// square (w by w); copies that land off the chart are skipped by callers.
function symmetricPoints(x, y, w, h) {
    const xMax = w - 1;
    const yMax = h - 1;
    switch (symSelect.value) {
        case 'vertical':   // Mirror L/R
            return [[x, y], [xMax - x, y]];
        case 'horizontal': // Mirror T/B
            return [[x, y], [x, yMax - y]];
        case '4xMagic':
        case '4xITR':      // Rotations by 0, 90, 180 and 270 degrees
            return [[x, y], [xMax - y, x], [xMax - x, xMax - y], [y, xMax - x]];
        case '8xMagic':
        case '8xITR':      // The 4 rotations plus their mirror images
            return [[x, y], [xMax - y, x], [xMax - x, xMax - y], [y, xMax - x],
                    [xMax - x, y], [y, x], [x, xMax - y], [xMax - y, xMax - x]];
        default:
            return [[x, y]];
    }
}

// Paint the brush area centered on (x, y), with symmetry, in targetValue
// (0 or 255). Doesn't validate; call finishPixelEdit() when done.
function paintBrushAt(x, y, targetValue) {
    const w = drawCanvas.width;
    const h = drawCanvas.height;

	// Helper to paint a single pixel to the drawCanvas
    const paint = (px, py) => {
		// Bounds check
        if (px < 0 || px >= w || py < 0 || py >= h) return;

        drawCtx.fillStyle = `rgb(${targetValue},${targetValue},${targetValue})`;
        drawCtx.fillRect(px, py, 1, 1);
    };

    // Loop through the brush area (same footprint as the brush preview)
    const { lo, hi } = brushSpan();
    for (let i = lo; i <= hi; i++) {
        for (let j = lo; j <= hi; j++) {
			// Target coords
            const tx = x + i;
            const ty = y + j;

			// Skip brush stitches outside the active symmetry region
			if (! pixelInActiveDrawingArea(tx, ty, w, h) )
                continue;

            symmetricPoints(tx, ty, w, h).forEach(([px, py]) => paint(px, py));
        }
    }
}

// After a click or a drawn stroke: mark the chart edited and re-validate
function finishPixelEdit() {
    // We've made changes, so mark as dirty to enable Revert
    // TODO/CBB - what if we toggled a stitch, then toggled it back? No net change.
    setDirty(true);
    setDownloadsAllowed(true);

    // AUTO-VALIDATE: Trigger the existing validation logic to refresh red boxes & anchor X's
    // We manually trigger the click event on the validate button
    validateBtn.click();
	render();
}


/** REVERT TO ORIGINAL **/

function setDirty(dirty) {
    //isDirty = dirty;
    revertBtn.disabled = !dirty;
	revertBtn.title = dirty ? "Revert To Original Image" : "No changes to revert";
	clearBtn.disabled = !dirty;  // TODO, that's not quite right
	//alert( "ClearBtn.disabled --->  " + !dirty + " in setDirty");

}

// TODO - this is superceded by ClearToA and ClearToB
revertBtn.addEventListener('click', () => {
    if (!originalImg) return;
    if (confirm("Are you sure? This will undo all edits.")) {
        recordUndo('revert');

        // Clear drawing canvas and redraw original
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        drawCtx.drawImage(originalImg, 0, 0);

        // Reset the active pixel info
        activePixel = null;
		validationOutput = [];
		validationStats = null;

		//alert("setDirty(false) and setDownloadsAllowed(true) in revert");

		// Let everyone know display image is now clean
		setDirty(false);
        render(); // Update visual canvas

		// Keep downloads enabled because the original image is still loaded
		setDownloadsAllowed(true);
    }
});

// --- Save Raw Image (The processed source data only) ---
downloadImgBtn.addEventListener('click', () => {
    if (!drawCanvas.width) return;
    if (!confirmSaveIfInvalid()) return;
	
	const usePhysical = document.getElementById('usePhysicalAspect').checked;
    const { pph, ppv } = appliedGauge();

    let exportCanvas = drawCanvas;

    if (usePhysical && pph !== ppv) {
        // Create a resampled canvas where pixels are made square
        const outW = Math.round(drawCanvas.width * (ppv / pph));
        const outH = drawCanvas.height;
        
        const temp = document.createElement('canvas');
        temp.width = outW;
        temp.height = outH;
        const tCtx = temp.getContext('2d');
        tCtx.imageSmoothingEnabled = false;
        tCtx.drawImage(drawCanvas, 0, 0, outW, outH);
        exportCanvas = temp;
    }	
	
    const link = document.createElement('a');
    link.download = 'processed-data.png';
    link.href = drawCanvas.toDataURL('image/png');
    link.click();
});

// --- Chart exports (Save Chart As Image / PDF) ---

// Exports are laid out as if zoomed to this many screen pixels per stitch,
// so ruler labels, line weights, and markings don't depend on the zoom
// you happen to be using
const EXPORT_STITCH_PX = 12;

// The part of the chart an export covers: the whole chart, or for
// In-The-Round (wedgeOnly) the box around the drawing wedge.
// inRegion(x, y) tells whether a stitch, in box coordinates, is exported.
function exportRegion(wedgeOnly) {
	const fullW = drawCanvas.width;
	const fullH = drawCanvas.height;
	let x0 = 0, y0 = 0, x1 = fullW, y1 = fullH;
	let inChart = () => true;
	if (wedgeOnly) {
		inChart = (x, y) => pixelInActiveDrawingArea(x, y, fullW, fullH);
		let bx0 = fullW, by0 = fullH, bx1 = 0, by1 = 0;
		for (let y = 0; y < fullH; y++) for (let x = 0; x < fullW; x++) {
			if (!inChart(x, y)) continue;
			bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x + 1);
			by0 = Math.min(by0, y); by1 = Math.max(by1, y + 1);
		}
		if (bx1 > bx0) { x0 = bx0; y0 = by0; x1 = bx1; y1 = by1; }
		else inChart = () => true;  // no wedge: whole chart
	}
	return {
		x0, y0, w: x1 - x0, h: y1 - y0,
		inRegion: (x, y) => inChart(x + x0, y + y0),
	};
}

// Space (in screen pixels, at EXPORT_STITCH_PX) around an exported piece
// of the chart for what's drawn outside it: physical-size rulers on the
// left and top, the row-color markers (one row tall, so a stitch wide) and
// row numbers on the right, and the stitch numbers below. See drawRulers
// and drawPhysicalSizeRulers.
function exportMargins() {
	const physical = physicalRulersToggle.checked;
	return {
		left: physical ? 70 : 25,   // a stitch number can be centered on the left edge
		top: physical ? 45 : 15,
		right: EXPORT_STITCH_PX + 50,
		bottom: 40,
	};
}

// Size in screen pixels of an exported piece w stitches by h rows
function exportScreenSize(w, h) {
	const m = exportMargins();
	return {
		w: w * EXPORT_STITCH_PX * aspectCorrectionX() + m.left + m.right,
		h: h * EXPORT_STITCH_PX + m.top + m.bottom,
	};
}

// Draw (part of) the chart onto a new canvas, with the overlays turned on
// in the Display menu (grid lines, stitch grid, rulers, invalid stitches,
// chart markings, non-square stitches). On-screen drawing aids (symmetry
// mask and center, brush preview, reference image) are left out.
//   k: device pixels per screen pixel; reduced if the canvas would be
//      larger than browsers allow, or longer than maxSide pixels on a side
//   print: black-and-white stitches and paper colors on white
//          (otherwise the palette colors on the editor's dark background)
//   region: from exportRegion() (default: the whole chart)
//   piece: {x0, y0, x1, y1}, the part of the region to draw (default: all
//          of it). Rulers keep the region's numbering, so a piece shows the
//          same stitch and row numbers it has in the whole.
// The canvas's `layout` says where the piece landed: canvas pixels per
// stitch (sx, sy) and the top-left corner of the stitches (left, top).
function renderChartForExport(k, { print = false, region = exportRegion(false), piece = null, maxSide = Infinity } = {}) {
	const fullH = drawCanvas.height;
	const aspectCorrX = aspectCorrectionX();
	const p = piece || { x0: 0, y0: 0, x1: region.w, y1: region.h };
	const w = p.x1 - p.x0;
	const h = p.y1 - p.y0;
	// Is (x, y), in piece coordinates, one of the stitches being drawn?
	const inPiece = (x, y) => region.inRegion(x + p.x0, y + p.y0);
	// Stitches right of, and rows below, the piece, for numbering
	const off = { x: region.w - p.x1, y: region.h - p.y1 };

	// Lay out at the export zoom, in the chosen colors; restored below
	const savedView = { ...viewState };
	const savedColors = overlayColors;
	viewState.scale = EXPORT_STITCH_PX;
	overlayColors = print ? OVERLAY_PRINT : OVERLAY_SCREEN;
	const vs = viewState.scale;

	try {
		const m = exportMargins();
		const screen = exportScreenSize(w, h);
		const MAX_SIDE = 16000, MAX_AREA = 100e6;
		const side = Math.min(MAX_SIDE, maxSide);
		k = Math.min(k, side / screen.w, side / screen.h, Math.sqrt(MAX_AREA / (screen.w * screen.h)));
		// A whole number of pixels per stitch keeps the grid lines crisp
		// (and the PNG small)
		if (k * vs >= 1) k = Math.floor(k * vs) / vs;

		const out = document.createElement('canvas');
		out.width = Math.ceil(screen.w * k);
		out.height = Math.ceil(screen.h * k);
		out.layout = { k, left: m.left * k, top: m.top * k, sx: k * vs * aspectCorrX, sy: k * vs };
		const c = out.getContext('2d');

		c.imageSmoothingEnabled = false;
		c.fillStyle = overlayColors.background;
		c.fillRect(0, 0, out.width, out.height);

		// Piece coordinates: one unit per stitch, inside the margins
		c.translate(m.left * k, m.top * k);
		c.scale(out.layout.sx, out.layout.sy);

		// Whole-chart coordinates of the piece's top-left stitch
		const cx0 = region.x0 + p.x0;
		const cy0 = region.y0 + p.y0;

		// Stitches: A white and B black for print, else the palette colors;
		// stitches outside the wedge are left blank
		let src = drawCanvas;
		if (!print) { updateDisplayBuffer(); src = displayCanvas; }
		const part = document.createElement('canvas');
		part.width = w; part.height = h;
		const pc = part.getContext('2d');
		pc.drawImage(src, cx0, cy0, w, h, 0, 0, w, h);
		const id = pc.getImageData(0, 0, w, h);
		let partial = false;
		for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
			if (!inPiece(x, y)) { id.data[(y * w + x) * 4 + 3] = 0; partial = true; }
		}
		if (partial) pc.putImageData(id, 0, 0);
		c.drawImage(part, 0, 0);

		// Grid over the whole piece, so for a wedge the lines reach from the
		// bottom and right-hand rulers to every stitch
		drawGrid(c, w, h, off);

		// Invalid stitches and markings: only over the stitches drawn
		c.save();
		const clip = new Path2D();
		if (partial) {
			for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
				if (inPiece(x, y)) clip.rect(x, y, 1, 1);
			}
		} else {
			clip.rect(0, 0, w, h);
		}
		c.clip(clip);
		c.translate(-cx0, -cy0);                  // these use whole-chart coordinates
		drawValidationErrors(c, drawCanvas.width, fullH);   // red outlines, if shown
		drawChartMarkings(c, drawCanvas.width, fullH);      // anchor X's, if shown
		c.restore();

		// On paper, outline the stitches drawn so white ones at the edge show
		if (overlayColors.chartOutline) {
			c.strokeStyle = overlayColors.chartOutline;
			c.lineWidth = 2 / vs;
			c.beginPath();
			for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
				if (!inPiece(x, y)) continue;
				if (y === 0 || !inPiece(x, y - 1))     { c.moveTo(x, y);     c.lineTo(x + 1, y); }
				if (y === h - 1 || !inPiece(x, y + 1)) { c.moveTo(x, y + 1); c.lineTo(x + 1, y + 1); }
				if (x === 0 || !inPiece(x - 1, y))     { c.moveTo(x, y);     c.lineTo(x, y + 1); }
				if (x === w - 1 || !inPiece(x + 1, y)) { c.moveTo(x + 1, y); c.lineTo(x + 1, y + 1); }
			}
			c.stroke();
		}

		// Row markers and rulers. Row colors alternate from the chart's
		// first (bottom) row, so a piece that starts an odd number of rows
		// up starts with the other color.
		const rowsBelow = fullH - (cy0 + h);
		const bottomIsWhite = (rowsBelow % 2 === 0) === firstRowAToggle.checked;
		drawRowCheckers(c, w, h, bottomIsWhite);
		drawRulers(c, w, h, off);
		if (physicalRulersToggle.checked) drawPhysicalSizeRulers(c, w, h, off);
		drawColumnSeparator(c, w, h);
		return out;
	} finally {
		Object.assign(viewState, savedView);
		overlayColors = savedColors;
	}
}

downloadChartImgBtn.addEventListener('click', () => {
    if (!drawCanvas.width) return;
    if (!confirmSaveIfInvalid()) return;

    // 3 device pixels per screen pixel: 36 pixels per stitch
    const out = renderChartForExport(3);

    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0,10);
    link.download = `chart-${dateStr}.png`;
    link.href = out.toDataURL('image/png');
    link.click();
});

// --- PDF ---

// Letter paper with half-inch margins; page headers sit in the top margin
const PDF_MARGIN_MM = 12.7;
// Smallest printed stitch (its height, in mm) before a chart is split
// across pages
const PDF_MIN_STITCH_MM = 2.5;

// Printable area of a letter page, in mm
function pdfPrintable(landscape) {
	const pageW = landscape ? 279.4 : 215.9;
	const pageH = landscape ? 215.9 : 279.4;
	return { w: pageW - 2 * PDF_MARGIN_MM, h: pageH - 2 * PDF_MARGIN_MM };
}

// How to lay the region out on paper: on one page if its stitches can be
// at least PDF_MIN_STITCH_MM tall, otherwise on pages of `per` stitches by
// rows, at a scale of mmPerScreenPx. Picks whichever page orientation
// needs fewer pages (or, for one page, gives bigger stitches).
function planPdfPages(region) {
	const best = [true, false].map(landscape => {
		const area = pdfPrintable(landscape);
		const whole = exportScreenSize(region.w, region.h);
		const fit = Math.min(area.w / whole.w, area.h / whole.h);  // mm per screen px
		if (fit * EXPORT_STITCH_PX >= PDF_MIN_STITCH_MM) {
			return { landscape, pages: 1, stitchMM: fit * EXPORT_STITCH_PX, mmPerScreenPx: fit };
		}
		// Stitches across and rows down that fit at the smallest stitch size,
		// rounded down to tens so page edges fall on the grid lines
		const mmPerScreenPx = PDF_MIN_STITCH_MM / EXPORT_STITCH_PX;
		const m = exportMargins();
		const across = Math.floor((area.w / mmPerScreenPx - m.left - m.right) / (EXPORT_STITCH_PX * aspectCorrectionX()));
		const down = Math.floor((area.h / mmPerScreenPx - m.top - m.bottom) / EXPORT_STITCH_PX);
		const tens = (n) => n >= 10 ? Math.floor(n / 10) * 10 : Math.max(1, n);
		const per = { x: tens(across), y: tens(down) };
		const pages = Math.ceil(region.w / per.x) * Math.ceil(region.h / per.y);
		// Scale so a full page of stitches fits
		const full = exportScreenSize(per.x, per.y);
		return { landscape, pages, per, mmPerScreenPx: Math.min(area.w / full.w, area.h / full.h) };
	});
	const [l, p] = best;
	if (l.pages !== p.pages) return l.pages < p.pages ? l : p;
	return (l.pages === 1 && p.stitchMM > l.stitchMM) ? p : l;
}

// The pieces of the region, one per page, numbered from the bottom right
// (stitch 1, row 1): right to left along the bottom, then up a row of
// pages, like the knitting. Pieces with no stitches to print are skipped.
function pdfPieces(region, per) {
	const pieces = [];
	for (let rowsBelow = 0; rowsBelow < region.h; rowsBelow += per.y) {
		for (let stitchesRight = 0; stitchesRight < region.w; stitchesRight += per.x) {
			const piece = {
				x0: Math.max(0, region.w - stitchesRight - per.x), x1: region.w - stitchesRight,
				y0: Math.max(0, region.h - rowsBelow - per.y),     y1: region.h - rowsBelow,
			};
			let any = false;
			for (let y = piece.y0; y < piece.y1 && !any; y++) for (let x = piece.x0; x < piece.x1; x++) {
				if (region.inRegion(x, y)) { any = true; break; }
			}
			if (any) pieces.push(piece);
		}
	}
	return pieces;
}

// Put a rendered canvas on the current PDF page: at the top of the
// printable area (below `below` mm of header), centered across, at
// mmPerScreenPx (or shrunk to fit)
function pdfPlaceCanvas(pdf, out, mmPerScreenPx, below = 0) {
	const pageW = pdf.internal.pageSize.getWidth();
	const pageH = pdf.internal.pageSize.getHeight();
	// mm per canvas pixel
	const scale = Math.min(mmPerScreenPx / out.layout.k,
	                       (pageW - 2 * PDF_MARGIN_MM) / out.width,
	                       (pageH - 2 * PDF_MARGIN_MM - below) / out.height);
	const wMM = out.width * scale;
	const hMM = out.height * scale;
	// PNG data is compressed losslessly ('FAST' is the deflate level), so
	// the stitches stay pixel-perfect without an enormous file
	pdf.addImage(out.toDataURL('image/png'), 'PNG', (pageW - wMM) / 2, PDF_MARGIN_MM + below, wMM, hMM, undefined, 'FAST');
}

downloadChartPDFBtn.addEventListener('click', async () => {
	if (!drawCanvas.width) return;
    if (!confirmSaveIfInvalid()) return;

    const { jsPDF } = window.jspdf;

    // Printed in black and white on white, whatever the palette; for
    // In-The-Round, just the wedge that is worked
    const region = exportRegion(validatesWedgeOnly());
    const plan = planPdfPages(region);
    const pdf = new jsPDF({ orientation: plan.landscape ? 'l' : 'p', unit: 'mm', format: 'letter' });

    // 3 device pixels per screen pixel (36 pixels per stitch), but no more
    // than about 300 dpi across the printable width (200 dpi for a chart
    // split across pages, whose stitches are bigger): sharp in print, and
    // quick to build. Most of the time goes to jsPDF reading each image.
    const dpi = plan.pages === 1 ? 300 : 200;
    const maxSide = Math.round(pdfPrintable(plan.landscape).w / 25.4 * dpi);
    const opts = { print: true, region, maxSide };

    if (plan.pages === 1) {
        pdfPlaceCanvas(pdf, renderChartForExport(3, opts), plan.mmPerScreenPx);
        pdf.save(`full-chart-${new Date().getTime()}.pdf`);
        return;
    }

    // Split across pages: an overview of the whole chart showing where
    // each page goes, then one page per piece, all at the same scale.
    // This takes a while for a big chart, so show progress on the button
    // and let the page update between pages.
    const pieces = pdfPieces(region, plan.per);
    const label = downloadChartPDFBtn.textContent;
    const progress = (text) => new Promise(resolve => {
        downloadChartPDFBtn.textContent = text;
        setTimeout(resolve, 0);
    });
    downloadChartPDFBtn.disabled = true;

    try {
        const header = (text) => {
            pdf.setFontSize(10);
            pdf.setTextColor(0);
            pdf.text(text, PDF_MARGIN_MM, PDF_MARGIN_MM - 4);
        };
        const range = (a, b) => (a === b ? `${a}` : `${a}–${b}`);

        // Overview: the whole chart shrunk onto one page, at 300 dpi so its
        // smaller stitches and numbers stay sharp
        await progress(`Saving PDF: overview`);
        const overview = renderChartForExport(3, { ...opts, maxSide: Math.round(pdfPrintable(plan.landscape).w / 25.4 * 300) });
        const L = overview.layout;
        const oc = overview.getContext('2d');
        const frame = Math.max(2, L.sy * 0.25);
        oc.save();
        oc.setTransform(1, 0, 0, 1, 0, 0);  // canvas pixels (layout), not chart units
        oc.textAlign = 'center';
        oc.textBaseline = 'middle';
        pieces.forEach((pc, i) => {
            const x = L.left + pc.x0 * L.sx, y = L.top + pc.y0 * L.sy;
            const w = (pc.x1 - pc.x0) * L.sx, h = (pc.y1 - pc.y0) * L.sy;
            oc.lineWidth = frame;
            oc.strokeStyle = '#0050c8';
            oc.strokeRect(x, y, w, h);
            // Page number, outlined in white so it reads over the stitches
            const size = Math.min(w, h) * 0.35;
            oc.font = `bold ${size}px sans-serif`;
            oc.lineWidth = size * 0.12;
            oc.strokeStyle = '#ffffff';
            oc.strokeText(`${i + 1}`, x + w / 2, y + h / 2);
            oc.fillStyle = '#0050c8';
            oc.fillText(`${i + 1}`, x + w / 2, y + h / 2);
        });
        oc.restore();
        header(`Overview: ${region.w} stitches × ${region.h} rows, printed on the ${pieces.length} pages ` +
               `that follow. Page 1 is the bottom right (stitch 1, row 1).`);
        pdfPlaceCanvas(pdf, overview, Infinity, 2);

        // One page per piece
        for (let i = 0; i < pieces.length; i++) {
            const pc = pieces[i];
            await progress(`Saving PDF: page ${i + 1} of ${pieces.length}`);
            pdf.addPage('letter', plan.landscape ? 'l' : 'p');
            header(`Page ${i + 1} of ${pieces.length}:  stitches ${range(region.w - pc.x1 + 1, region.w - pc.x0)},  ` +
                   `rows ${range(region.h - pc.y1 + 1, region.h - pc.y0)}`);
            pdfPlaceCanvas(pdf, renderChartForExport(3, { ...opts, piece: pc }), plan.mmPerScreenPx);
        }

        await progress(`Saving PDF…`);
        pdf.save(`full-chart-${new Date().getTime()}.pdf`);
    } finally {
        downloadChartPDFBtn.textContent = label;
        downloadChartPDFBtn.disabled = false;
    }
});


/*
const exportWorkspaceBtn = document.getElementById('exportWorkspaceBtn');

exportWorkspaceBtn.addEventListener('click', () => {
    if (!drawCanvas.width) return alert("Nothing to export!");

	// Helper to safely get element values
    const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`Element with ID "${id}" not found.`);
            return ""; // Fallback value
        }
        return el.type === 'checkbox' ? el.checked : el.value;
    };

    const workspaceData = {
        image: drawCanvas.toDataURL(),
        lastSaved: new Date().toLocaleString(),
        settings: {
            pp4h: getVal('pp4h'),
            pp4v: getVal('pp4v'),
			newUnit: getVal('unitSelect'),
            thresholdRange: getVal('thresholdRange'),
            showGrid: getVal('showGrid'),
            showSubGrid: getVal('showSubGrid'),
            physicalRulersToggle: getVal('physicalRulersToggle'),
            firstRowA: getVal('firstRowA')
        }
    };

    // Create a Blob from the JSON string
    const dataStr = JSON.stringify(workspaceData);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `workspace_${new Date().getTime()}.json`;
    link.click();

    // Clean up
	URL.revokeObjectURL(url);
});

const importWorkspaceBtn = document.getElementById('importWorkspaceBtn');
const importWorkspaceInput = document.getElementById('importWorkspaceInput');

importWorkspaceBtn.addEventListener('click', () => importWorkspaceInput.click());

importWorkspaceInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            // Re-load image and settings
            const tempImg = new Image();
            tempImg.onload = () => {
                img = tempImg;
                originalImg = tempImg;
                bgCanvas.width = drawCanvas.width = displayCanvas.width = img.width;
                bgCanvas.height = drawCanvas.height = displayCanvas.height = img.height;
                bgCtx.drawImage(img, 0, 0);

				// IMPORTANT: Resize the visible mainCanvas to fit the screen
				// This sets canvas.width/height to parent container dimensions
				resetView();

                // Restore UI Settings
                Object.keys(data.settings).forEach(key => {
                    const el = document.getElementById(key);
                    if (el) {
                        if (el.type === 'checkbox') el.checked = data.settings[key];
                        else el.value = data.settings[key];
                    }
                });

                resetView();
                render();
                alert("Workspace imported successfully!");
            };
	        tempImg.src = data.image;

			//alert("setDownloadsAllowed(true) in importWorkspace");

			// Update UI states
			setDownloadsAllowed(true);
			clearBtn.disabled = false;
			revertBtn.disabled = false;
			//alert( "ClearBtn.disabled --->  " + false + " in importWorkspace");

			
        } catch (err) {
            alert("Error: Invalid workspace file.");
        }
    };

	// All of that ^^ was to set up the onLoad callback
	// Now, trigger it.

	reader.readAsText(file);
});
*/  // e/o Workspace stuff

/** Window Resize Listener **/
window.addEventListener('resize', () => {
    if (!drawCanvas.width) return; // Don't do anything if no image is loaded

    // 1. Recalculate canvas size and image centering
    resetView();

    // 2. Redraw everything (image, rulers, grid) for the new size
    render();
});

/** SIDEBAR OPEN/COLLAPSE **/
/** 1. Sidebar Collapse Logic **/
function toggleSidebar(isCollapsed) {
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        openSidebarBtn.classList.remove('hidden');
    } else {
        sidebar.classList.remove('collapsed');
        openSidebarBtn.classList.add('hidden');
    }

    // Wait for the CSS transition (300ms) then resize the canvas
    setTimeout(() => {
        resetView();
        render();
    }, 305);
}

toggleSidebarBtn.addEventListener('click', () => toggleSidebar(true));
openSidebarBtn.addEventListener('click', () => toggleSidebar(false));

/** 2. Fullscreen Logic **/
fullscreenBtn.addEventListener('click', () => {
    const container = document.querySelector('.editor-container');

    if (!document.fullscreenElement) {
        // Request fullscreen on the container to keep rulers visible
        container.requestFullscreen().catch(err => {
            alert(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
});

// Listener to resize canvas when entering/exiting fullscreen
document.addEventListener('fullscreenchange', () => {
    // When in fullscreen, the sidebar is usually hidden for a cleaner view
    if (document.fullscreenElement) {
        toggleSidebar(true);
        fullscreenBtn.innerText = "Exit";
    } else {
        toggleSidebar(false);
        fullscreenBtn.innerText = "⛶";
    }
    resetView();
    render();
});


function updateStatusWindow() {
	const z = Math.round(viewState.scale * 100);
	const w = drawCanvas.width;
	const h = drawCanvas.height;
	// Always display zoom and image size
    let html = `<strong>Zoom: ${z}%</strong><br>`;

	// if the user has specified the image size unit as "Inches"
	// show physical size AND pixels

	if (unitSelect.value === 'in') {
		// Gauge applied to the chart
		const { pph, ppv } = appliedGauge();

		// Calculate Inches
		const inchW = (w / pph).toFixed(2);
		const inchH = (h / ppv).toFixed(2);
		html += `Chart size: ${inchW}" x ${inchH}"  (${w} sts x ${h} rows)`;
		//console.log( `Chart size: ${inchW}" x ${inchH}" (${img.width} sts x ${img.height} rows)`);
	}
	else {
		html += `Chart size: ${w} sts x ${h} rows`;
		//console.log(`Chart size: ${w} sts x ${h} rows`);
	}

    // Only show stats if a Validate run has occurred and hasn't been invalidated
    if (validationStats && validationStats.invalid !== undefined) {
		// Apply "stale" styling if dirty
        const style = vStatsDirty
            ? 'color: #888; opacity: 0.6; font-style: italic;'
            : 'color: #fff; opacity: 1;';
        const label = vStatsDirty ? ' (Approximate)' : '';
		html += `<div style="margin-top: 10px; border-top: 1px solid #444; padding-top: 5px; ${style}">`;
        html += `<strong>Stats${label}:</strong><br>`;
        html += `<span style="color:${vStatsDirty ? '#888' : '#ff4444'}">Invalid: ${validationStats.invalid} (${validationStats.percent}%)</span>`;
        html += `<br><span style="color:${vStatsDirty ? '#888' : '#00ffff'}">Anchors: ${validationStats.topAnchor}</span>`;
        html += `</div>`;
    }

    if (activePixel) {
        html += `<hr style="border-color: #222;">`;
        html += `Pixel (RTL:${activePixel.displayX}, BTT:${activePixel.displayY})<br>`;
        html += `RGBA: [${activePixel.r},${activePixel.g},${activePixel.b},${activePixel.a}]`;
    }
    status.innerHTML = html;
}

/** Collapsible Sidebar Sections **/
document.querySelectorAll('.section-toggle').forEach(header => {
    header.addEventListener('click', () => {
        // Find the parent .sidebar-section and toggle its state
        const section = header.parentElement;
        section.classList.toggle('collapsed');
    });
});

const symV = document.getElementById('symV');
const symH = document.getElementById('symH');
const symD1 = document.getElementById('symD1');
const symD2 = document.getElementById('symD2');

symSelect.addEventListener('change', () => {
    const symMode = symSelect.value;
    // Update Icon Colors/Visibility
	// Perpendiculars: one or the other for the mirror modes. Both for 4x and the 8x's
    const hasVertical = (symMode === 'vertical') || (symMode === '4xMagic') || (symMode === '8xMagic') || (symMode === '8xITR');
    symV.style.stroke = hasVertical ? '#00ff00' : '#333';

    const hasHorizontal = (symMode === 'horizontal') || (symMode === '4xMagic') || (symMode === '8xMagic') || (symMode === '8xITR');
    symH.style.stroke = hasHorizontal ? '#00ff00' : '#333';

	// Diagonals: 4x In-The-Round, and both 8x's
    const hasDiagonals = (symMode === '4xITR') || (symMode === '8xITR') || (symMode === '8xMagic');
    symD1.style.display = symD2.style.display = hasDiagonals ? 'block' : 'none';
    symD1.style.stroke = symD2.style.stroke = hasDiagonals ? '#00ff00' : '#333';

    // Which stitches get validated depends on the mode
    if (validationStats) validateBtn.click();

    render();
});
