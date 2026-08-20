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
        canvas.style.cursor = 'grab';
    }
});
window.addEventListener('keyup', (e) => { 
    if(e.code === 'Space') {
        spacePressed = false;
        canvas.style.cursor = 'crosshair';
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
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const worldX = (centerX - viewState.x) / viewState.scale;
    const worldY = (centerY - viewState.y) / viewState.scale;

    const newScale = viewState.scale * factor;
    if (newScale > 0.01 && newScale < 100) {
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
        canvas.style.cursor = 'grabbing';
        lastMouse = { x: e.offsetX, y: e.offsetY };
    } else {
        handlePixelClick(e);
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
    canvas.style.cursor = spacePressed ? 'grab' : 'crosshair';
});


/** 3. PIXEL LOGIC **/


function handlePixelClick(e) {
     if (!drawCanvas.width) return;
    const rawX = Math.floor((e.offsetX - viewState.x) / viewState.scale);
    const rawY = Math.floor((e.offsetY - viewState.y) / viewState.scale);

    if (rawX >= 0 && rawX < drawCanvas.width && rawY >= 0 && rawY < drawCanvas.height) {
        const p = drawCtx.getImageData(rawX, rawY, 1, 1).data;
        
        // Update global state
        activePixel = {
            rawX, rawY,
            displayX: (drawCanvas.width - 1) - rawX,
            displayY: (drawCanvas.height - 1) - rawY,
            r: p[0], g: p[1], b: p[2], a: p[3]
        };

        togglePixelCommand(rawX, rawY, activePixel);
        render(); // Force a render to update the info box immediately
    }
}


/**  Track Mouse Position for Preview of Brush Effect Region **/
canvas.addEventListener('mousemove', (e) => {
    if (!drawCanvas.width) return;

    // Map screen mouse position to image coordinates
    const rx = Math.floor((e.offsetX - viewState.x) / viewState.scale);
    const ry = Math.floor((e.offsetY - viewState.y) / viewState.scale);

    mouseImagePos = { x: rx, y: ry };

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

function togglePixelCommand(x, y) {
    const symMode = symSelect.value;
    const w = drawCanvas.width;
    const h = drawCanvas.height;

	// Helper to paint a single pixel to the drawCanvas
    const paint = (px, py) => {
		// Bounds check
        if (px < 0 || px >= w || py < 0 || py >= h) return;

        drawCtx.fillStyle = `rgb(${targetValue},${targetValue},${targetValue})`;
        drawCtx.fillRect(px, py, 1, 1);
    };

	const size = parseInt(brushSlider.value);
    const radius = Math.floor(size / 2);

    // 1. Determine the target color based on the current state
	// of the center brush pixel (click location)
    const centerPixel = drawCtx.getImageData(x, y, 1, 1).data;
    const centerLuminance = (centerPixel[0] * 0.299 + centerPixel[1] * 0.587 + centerPixel[2] * 0.114);
    const targetValue = centerLuminance >= 128 ? 0 : 255;

    // 2. Loop through the brush area
    for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= radius; j++) {
			// Target coords
            const tx = x + i;
            const ty = y + j;

			if (! pixelInActiveDrawingArea( tx, ty, h, w) )
                return;

            if (symMode === 'none'){
                paint(tx, ty);
			} else {
                // 1. Force the logic into a SQUARE based on the current width
                // Center coords
				const cx = w / 2;
                const cy = w / 2; // Using Width for both to ensure square logic

				// Relative coords
                const rx = tx - cx;
                const ry = ty - cy;

			// 1. Mirror Vertical (Left-Right)
                if (symMode === 'vertical') {
                    paint(tx, ty);
                    paint(w - tx, ty);
                }
                // 2. Mirror Horizontal (Top-Bottom)
                else if (symMode === 'horizontal') {
                    paint(tx, ty);
                    paint(tx, h - ty);
                }

                // TODO/CBB - for now, apply same triangle logic for both 4x's
                // Eventually - 4xMagic could be corner boxes rather than wedges
				else if ((symMode === "4xMagic") || (symMode === "4xITR")) {
					// Only allow drawing if inside the TOP triangle
					// ry < 0 == above center point
                    // rx <= abs(ry) == within 45-degree lines

                    paint(tx, ty); // Bottom (Source)
                    paint(h - tx, w - ty); // Top
                    paint(ty, h - tx); // Right
                    paint(w - ty, tx); // Left
				}
                // The 8x's are both the same 45-degree wedges
				else if ( (symMode === '8xMagic') || (symMode === '8xITR') ){
                    // Coordinates: (x,y), (-x,y), (x,-y), (-x,-y),
                    //              (y,x), (-y,x), (y,-x), (-y,-x)
                        const pts = [
                            [cx + rx, cy + ry], [cx - rx, cy + ry], // Bottom
                            [cx + rx, cy - ry], [cx - rx, cy - ry], // Top
                            [cx + ry, cy + rx], [cx - ry, cy + rx], // Right
                            [cx + ry, cy - rx], [cx - ry, cy - rx]  // Left
                        ];
                        pts.forEach(p => paint(Math.round(p[0]), Math.round(p[1])));
				}
            }
        }
    }

    // 3. Update activePixel global for UI consistency
    if (activePixel) {
        activePixel.r = activePixel.g = activePixel.b = targetValue;
    }

    // 4. We've made changes, so mark as dirty to enable Revert
    // TODO/CBB - what if we toggled a stitch, then toggled it back? No net change.
    setDirty(true);
    setDownloadsAllowed(true);

	// If we have existing stats, perform a live update
    if (validationStats) {
        performLiveValidation(x - radius, size);
    } else {
        // If no stats exist, just mark dirty as usual
        vStatsDirty = true;
	}

    // 5. AUTO-VALIDATE: Trigger the existing validation logic to refresh red boxes & anchor X's
    // We manually trigger the click event on the validate button

    validateBtn.click();

    //console.log(`Stitch at ${x}, ${y} inverted to ${targetValue === 255 ? 'White' : 'Black'}.`);
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
	
	const usePhysical = document.getElementById('usePhysicalAspect').checked;
    const pph = (parseFloat(document.getElementById('pp4h').value) || 1200) / 4;
    const ppv = (parseFloat(document.getElementById('pp4v').value) || 1200) / 4;

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

// This doesn't address stitch aspect ratio, because
// we're snapshotting exactly what's displayed, and that has
// been rendered with usePhysical toggle setting.
downloadChartImgBtn.addEventListener('click', () => {
    if (!drawCanvas.width) return;

    // We create a temporary link to trigger the download
    const link = document.createElement('a');

    // Set filename with current date for 2026
    const dateStr = new Date().toISOString().slice(0,10);
    link.download = `chart-${dateStr}.png`;

    // This takes a "snapshot" of exactly what you see on the mainCanvas
    // including the background transparency grid if the image doesn't cover it
    link.href = canvas.toDataURL('image/png');

    link.click();
});

downloadChartPDFBtn.addEventListener('click', () => {
	if (!drawCanvas.width) return;
	
    if (validationStats.invalid > 0)
    {
        if (! confirm("The chart has invalid pixels. Continue to export?")) 
            return;
    }

    const { jsPDF } = window.jspdf;
	
	// Handle non-square stitch gauge
	const pph = (parseFloat(document.getElementById('pp4h').value) || 1200) / 4;
	const ppv = (parseFloat(document.getElementById('pp4v').value) || 1200) / 4;
	const aspectCorrX = ppv / pph;

	// 1. Create a hidden temporary canvas at higher DPI
	const exportScale = 6 * viewState.scale;  //  THAT WAS THE KEY TO UNBLURRED X's
	const imgW = drawCanvas.width;
	const imgH = drawCanvas.height;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    // Set dimensions to include the image PLUS the ruler margins
    const margin = 15 * exportScale; // Extra space for ruler labels

	// Canvas is now larger than the source image by exportScale
    tempCanvas.width = (imgW * exportScale) + margin;
    tempCanvas.height = (imgH * exportScale) + margin;

	//console.log(`PDF export: drawCanvas dims ${imgW} x ${imgH}, tempCanvas dims ${tempCanvas.width} x ${tempCanvas.height}`);

    // 2. Setup high-quality rendering (No smoothing)
    tempCtx.imageSmoothingEnabled = false;
    //tempCtx.textBaseline = "top"; // prevents text fuzziness
    tempCtx.fillStyle = "#1a1a1a"; // Match your editor background
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Shift the drawing area so rulers fit in the top/left  margins
	tempCtx.save();
	tempCtx.translate(margin/2.0, margin/2.0);
    tempCtx.scale(exportScale * aspectCorrX, exportScale);
	//console.log(`PDF export: aspectCorrX ${aspectCorrX}, exportScale ${exportScale}`);

    // 3. Temporarily store and override global state
    const oldState = { ...viewState }; // current pan/zoom

	const originalCtx = window.ctx; // Save the main screen context
    const oldScale = viewState.scale;
    const oldX = viewState.x;
    const oldY = viewState.y;

    // Redirect all drawing to the PDF canvas
    window.ctx = tempCtx; 

	// July 3: are these causing problems in draw functions logic?
    //viewState.scale = 1; // fix 21 June exportScale;
    //viewState.x = 0;
    //viewState.y = 0;

	// --- DRAWING PASS

	// A) Draw the working layer
	tempCtx.globalAlpha = 1.0;
	/* if we want the background image too
	    tempCtx.drawImage(bgCanvas, 0, 0);
	*/
    tempCtx.drawImage(drawCanvas, 0, 0); // Draw B/W chart image offset by top margin
	
	// B) Draw the overlays
	drawRowCheckers(tempCtx, imgW, imgH);
    if (gridToggle.checked) drawGrid(tempCtx, imgW, imgH);
	drawRulers(tempCtx, imgW, imgH);
	if (physicalRulersToggle.checked) drawPhysicalSizeRulers(tempCtx, imgW, imgH);
	drawColumnSeparator(tempCtx, imgW, imgH);
	drawValidationErrors(tempCtx, imgW, imgH);  // draw the red boxes
	drawChartMarkings(tempCtx, imgW, imgH);     // draw the drop X's
	// don't draw symmetry mask or brush preview

	tempCtx.restore();

    // 4. Generate the PDF
    const imgData = tempCanvas.toDataURL("image/png", 1.0);  // 1.0 --> max quality
    /*
    const pdf = new jsPDF({
        orientation: tempCanvas.width > tempCanvas.height ? 'l' : 'p',
        unit: 'px',
        format: [tempCanvas.width, tempCanvas.height]
    });
    */
    const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'letter'
    });


    //pdf.addImage(imgData, 'PNG', 0, 0, tempCanvas.width, tempCanvas.height);

    // Explicitly append compression and resolution parameters
    const aspectRatio = (1.0 * tempCanvas.height) / tempCanvas.width;

	const letterWidthMM = 215.9; // 8.5 inches
	const letterHeightMM = 279.4;  // 11 inches

	// default: assumes chart is short and wide
	let targetWidthMM = letterWidthMM;
    let targetHeightMM = letterWidthMM * aspectRatio;

	// if chart is tall & narrow, scale by height instead
    if (targetHeightMM > letterHeightMM) {
		targetHeightMM = letterHeightMM;
		targetWidthMM = letterHeightMM / aspectRatio;
	}

    pdf.addImage(
    imgData,
    'PNG',
    0,
    0,
    targetWidthMM,
    targetHeightMM,
    undefined, // Alias
    'NONE'     // <--- STOP COMPRESSION! Keeps canvas source 100% pixel-perfect
    );



    pdf.save(`full-chart-${new Date().getTime()}.pdf`);

    // 5. RESTORE ORIGINAL STATE
    window.ctx = originalCtx;
    viewState = oldState;  // pan/zoom
	viewState.scale = oldScale;
    viewState.x = oldX;
    viewState.y = oldY;
    render(); // Refresh the screen to its original zoom
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
		// Calculate current gauge from the 4-inch inputs
		const pph = parseFloat(document.getElementById('pp4h').value) / 4;
		const ppv = parseFloat(document.getElementById('pp4v').value) / 4;

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
	// Perpendiculars: one or the other for the mirror modes. Both for 4xMagic and the 8x's
    const hasVertical = (symMode === 'vertical') || (symMode === '4xMagic') || (symMode === '8xMagic') || (symMode === '8xITR');
    symV.style.stroke = hasVertical ? '#00ff00' : '#333';

    const hasHorizontal = (symMode === 'horizontal') || (symMode === '4xMagic') || (symMode === '8xMagic') || (symMode === '8xITR');
    symH.style.stroke = hasHorizontal ? '#00ff00' : '#333';

	// Diagonals:  4xITR, and both 8x's
    const hasDiagonals = (symMode === '4xITR') || (symMode === '8xITR') || (symMode === '4xITR')
    symD1.style.display = symD2.style.display = hasDiagonals ? 'block' : 'none';
    symD1.style.stroke = symD2.style.stroke = hasDiagonals ? '#00ff00' : '#333';

    render();
});
