const targetW = document.getElementById('targetW');
const targetH = document.getElementById('targetH');
const lockAspect = document.getElementById('lockAspect');


function setTargetDimensions(w,h,units)
{
	document.getElementById('targetW').value = w;
	document.getElementById('targetH').value = h;
	unitSelect.value = units;
}

/** Get desired pixel row/col tallies, regardless of how they were specified **/
function getTargetDimensions() {
    let w = parseFloat(document.getElementById('targetW').value);
    let h = parseFloat(document.getElementById('targetH').value);

    const pph = parseFloat(document.getElementById('pp4h').value) / 4;
    const ppv = parseFloat(document.getElementById('pp4v').value) / 4;

    if (unitSelect.value === 'in') {
        w = Math.round(w * pph);
        h = Math.round(h * ppv);
    }

    return { w, h, pph, ppv };
}

/** Unified Command Handlers **/

// CREATE NEW
document.getElementById('btnNew').addEventListener('click', () => {
    const { w, h } = getTargetDimensions();
    if (w > 0 && h > 0) createNewImage(w, h);
});


// RESIZE ALL LAYERS
document.getElementById('btnResizeAllLayers').addEventListener('click', () => {
    // 1. Safety Checks
    if (!drawCanvas.width) return;

    const { w, h } = getTargetDimensions();
    if (w > 0 && h > 0) performResizeAll(w, h);
});

// CHANGE GAUGE
document.getElementById('btnGauge').addEventListener('click', () => {
    // 1. Safety Checks
    if (!drawCanvas.width) return;

    // 2. Get the NEW target gauge (calculated from the 4-inch inputs)
    const pph = parseFloat(document.getElementById('pp4h').value) / 4;
    const ppv = parseFloat(document.getElementById('pp4v').value) / 4;

    // Use the OLD gauge stored in datasets to find CURRENT inch size
    // We use drawCanvas.width because 'img' might be the old, original size
    const oldPph = parseFloat(pp4hInput.dataset.oldGauge || 300);
    const oldPpv = parseFloat(pp4vInput.dataset.oldGauge || 300);

    const currentInchesW = drawCanvas.width / oldPph;
    const currentInchesH = drawCanvas.height / oldPpv;

     // 4. Calculate the NEW pixel dimensions needed to keep those inches
    const targetW = Math.round(currentInchesW * pph);
    const targetH = Math.round(currentInchesH * ppv);

    // 5. Execute the 3-layer resize
    performResizeAll(targetW, targetH);

    // 6. Sync the dataset so the next gauge change is relative to this one
    updateGaugeReference();

	// these might be redundant, as performResizeAll does them at the end
	updateStatusWindow(); // Refresh the "Inches" readout in the sidebar
    render();   // Redraw rulers with the new physical measurements

    console.log(`Gauge Change: Resized to ${targetW} x ${targetH} px to maintain ${currentInchesW.toFixed(2)}" x ${currentInchesH.toFixed(2)}"`);
});


// Helper function to resize a specific canvas layer
function resizeLayer (oldCanvas, width, height)
{
        const temp = document.createElement('canvas');
        const tCtx = temp.getContext('2d', { willReadFrequently: true });
        temp.width = width;
        temp.height = height;

        tCtx.imageSmoothingEnabled = false;
        tCtx.drawImage(oldCanvas,        //<<<<<<   PROBLEM
            0, 0, /* <<  source offsets */
            oldCanvas.width, oldCanvas.height,
            0, 0,  /* <<  dest offsets */
            width, height);
        return temp;
}



const btnResizeChartToBG = document.getElementById('btnResizeChartToBG');

/** Match Drawing Layer size to Background Layer size **/
btnResizeChartToBG.addEventListener('click', () => {
    // 1. Check if a background image exists
    if (!bgCanvas.width || !bgCanvas.height) {
        alert("Please load a background image first.");
        return;
    }

    // 2. Confirm if data might be lost (resizing a canvas clears it)
    if (confirm("Resizing the drawing layer will clear your current work. Match size anyway?")) {

        // Save old dimensions for logging
        const oldW = drawCanvas.width;
        const oldH = drawCanvas.height;

        // 3. Update Drawing and Display Layer dimensions
		const targetW = bgCanvas.width;
		const targetH = bgCanvas.height;
        drawCanvas.width = targetW;
		displayCanvas.width = targetW;
        drawCanvas.height = targetH;
		displayCanvas.height = targetH;

        // 4. Fill with default White (Clean Slate)
        drawCtx.fillStyle = "#FFFFFF";
        drawCtx.fillRect(0, 0, targetW, targetH);

        // 5. Reset states
        activePixel = null;
        validationOutput = [];
        validationStats = null;
        isStatsDirty = false;
        setDirty(true);

        // 6. Recalculate zoom/centering and refresh
        resetView();

		// 7. Force the display buffer to update immediately
		// so render() has new pixel data to draw
		updateDisplayBuffer();
        render();

        console.log(`Resized Drawing Layer from ${oldW} x ${oldH} to ${bgCanvas.width} x ${bgCanvas.height}`);
    }
});

const btnResizeBGToChart = document.getElementById('btnResizeBGToChart');

/** Match Background Layer size to Drawing Layer size **/
btnResizeBGToChart.addEventListener('click', () => {
    alert("WIP - resize BG to Chart size");

    // 1. Check whether layers exist
    if (!drawCanvas.width || !drawCanvas.height) {
        alert("Please create a chart layer first.");
        return;
    }
    if (!bgCanvas.width || !bgCanvas.height) {
        alert("Please load a background image first.");
        return;
    }

    // 2. Save old dimensions for logging
    const oldW = bgCanvas.width;
    const oldH = bgCanvas.height;

    // 3. Update BG dimensions (no need to change display layer, it tracks Drawing)
    const targetW = drawCanvas.width;
    const targetH = drawCanvas.height;

    // 4. Resample BG into new size
    // TODO - confirm
    const resizedBg = resizeLayer(bgCanvas, targetW, targetH);
    bgCanvas = resizedBg;

    // 5. Reset states
    activePixel = null;
    validationOutput = [];
    validationStats = null;
    isStatsDirty = false;
    setDirty(true);

    // 6. Recalculate zoom/centering and refresh
    resetView();

    // 7. Force the display buffer to update immediately
    // so render() has new pixel data to draw
    updateDisplayBuffer();
    render();

    console.log(`Resized Reference Layer from ${oldW} x ${oldH} to ${drawCanvas.width} x ${drawCanvas.height}`);

});


/** 2. Resize Logic **/
function performResizeAll(newW, newH) {

	// Resize both core layers (Drawing and Background)
    const resizedDraw = resizeLayer(drawCanvas, newW, newH);
    const resizedBg = resizeLayer(bgCanvas, newW, newH);

    /* ------------ are these redundant given the two calls to resizeLayer ^^ */
	// Update the Background Layer (bgCanvas)
    bgCanvas.width = newW;
    bgCanvas.height = newH;
    bgCtx.imageSmoothingEnabled = false;
    bgCtx.drawImage(resizedBg, 0, 0);

    // 4. Update the Drawing Layer (drawCanvas)
    drawCanvas.width = newW;
    drawCanvas.height = newH;
    drawCtx.imageSmoothingEnabled = false;
    drawCtx.drawImage(resizedDraw, 0, 0);

    /* -------------------------------------------------- */

    // 5. Update the Display Buffer (displayCanvas)
    displayCanvas.width = newW;
    displayCanvas.height = newH;
    // (updateDisplayBuffer() will handle the pixel mapping during render)

    // 6. Update the global Image object for "Revert" baseline
    // We use the background as the new originalImg baseline
    const resizedDataUrl = bgCanvas.toDataURL();
    const resizedImg = new Image();

	resizedImg.onload = () => {
        originalImg = resizedImg; // New baseline for "Revert"
        
        // Reset states
        activePixel = null;
        validationErrors = [];
        validationStats = null;
        isStatsDirty = false;
        setDirty(true);
        
        resetView();
        if (typeof updateResizeInputs === 'function') updateResizeInputs();
        render();

        // 7. Update Status Window
        const unit = document.getElementById('unitSelect').value;
        if (unit === 'in') {
            const pph = parseFloat(document.getElementById('pp4h').value) / 4;
            const ppv = parseFloat(document.getElementById('pp4v').value) / 4;
            const inchW = (newW / pph).toFixed(2);
            const inchH = (newH / ppv).toFixed(2);
            status.innerHTML = `Resized to ${inchW}" x ${inchH}" (${newW} x ${newH} px)`;
        } else {
            status.innerHTML = `Resized to ${newW} x ${newH} px`;
        }
    };
    resizedImg.src = resizedDataUrl;
}

/** 3. Sync Inputs Based on Aspect Ratio **/
function syncDimensions(changedField) {
    // 1. Check if a drawing layer exists to provide a ratio
    if (!drawCanvas.width || drawCanvas.height === 0) return;

    // 2. Only proceed if Lock Aspect is checked
    if (!lockAspect.checked) return;

    // 3. Use the CURRENT canvas dimensions for the ratio
    const currentRatio = drawCanvas.width / drawCanvas.height;

    if (changedField === 'width') {
        const w = parseFloat(targetW.value);
        if (!isNaN(w) && w > 0) {
            // newHeight = newWidth / aspectRatio
            // We use Math.round or toFixed based on your Unit (px vs in)
            const unit = unitSelect.value;
            const newH = w / currentRatio;
            targetH.value = (unit === 'px') ? Math.round(newH) : newH.toFixed(2);
        }
    } else {
        const h = parseFloat(targetH.value);
        if (!isNaN(h) && h > 0) {
            // newWidth = newHeight * aspectRatio
            const unit = unitSelect.value;
            const newW = h * currentRatio;
            targetW.value = (unit === 'px') ? Math.round(newW) : newW.toFixed(2);
        }
    }
}


// Add listeners to trigger the sync while typing
targetW.addEventListener('input', () => syncDimensions('width'));
targetH.addEventListener('input', () => syncDimensions('height'));

/** 4. Populate Inputs on Load/Resize **/
function updateResizeInputs(useOriginal = false) {
    // 1. Safety Check: ensure workspace exists
    if (!drawCanvas.width) return;
    
	// Determine image reference: bgCanvas/originalImg for "Original", drawCanvas for "Current"
    let refW, refH;
    if (useOriginal && originalImg) {
        refW = originalImg.width;
        refH = originalImg.height;
    } else {
        refW = drawCanvas.width;
        refH = drawCanvas.height;
    }

    if (unitSelect.value === 'px') {
        targetW.value = Math.round(refW);
        targetH.value = Math.round(refH);
    } else {
        const pph = (parseFloat(document.getElementById('pp4h').value) || 1200) / 4;
        const ppv = (parseFloat(document.getElementById('pp4v').value) || 1200) / 4;

        targetW.value = (refW / pph).toFixed(2);
        targetH.value = (refH / ppv).toFixed(2);
    }
}

const resetResizeLink = document.getElementById('resetResizeLink');

/** 5. Reset to Original Dimensions Logic **/
resetResizeLink.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent page jump from '#' link
    if (!originalImg) return;

    // We use the 'originalImg' reference we saved during upload
    // to populate the width/height fields in the currently selected unit
    updateResizeInputs(true); // Passing 'true' to force original dimensions

    // If Lock Aspect is on, ensure the ratio is maintained correctly
	syncDimensions('width');

	console.log("Resize inputs reset to original background dimensions.");
});


// Update the "oldGauge" reference whenever a new image is loaded/created
// used to track gauge changes for potential auto-scaling
function updateGaugeReference() {
    const pp4h = document.getElementById('pp4h');
    const pp4v = document.getElementById('pp4v');

    const pph = parseFloat(pp4h.value) / 4;
    const ppv = parseFloat(pp4v.value) / 4;

    pp4h.dataset.oldGauge = pph;
    pp4v.dataset.oldGauge = ppv;
}

document.getElementById('cropToSquareBtn').addEventListener('click', () => {
    if (!drawCanvas.width) return;

    const w = drawCanvas.width;
    const h = drawCanvas.height;

    if (w === h) {
        alert("Image is already square.");
        return;
    }

    if (confirm("This will crop your image to a centered square based on the shortest side. Continue?")) {
        // 1. Find the size of the square (the smaller dimension)
        const size = Math.min(w, h);

        // 2. Calculate the top-left offset to keep it centered
        const offsetX = Math.floor((w - size) / 2);
        const offsetY = Math.floor((h - size) / 2);

        // 3. Create a helper to crop each layer
        const cropLayer = (oldCanvas) => {
            const temp = document.createElement('canvas');
            const tCtx = temp.getContext('2d', { willReadFrequently: true });
            temp.width = size;
            temp.height = size;
            tCtx.imageSmoothingEnabled = false;
            // Draw only the center portion of the old canvas
            tCtx.drawImage(oldCanvas, offsetX, offsetY, size, size, 0, 0, size, size);
            return temp;
        };

        // 4. Process all three layers
        const croppedBg = cropLayer(bgCanvas);
        const croppedDraw = cropLayer(drawCanvas);

        // Update background
        bgCanvas.width = size; bgCanvas.height = size;
        bgCtx.drawImage(croppedBg, 0, 0);

        // Update drawing
        drawCanvas.width = size; drawCanvas.height = size;
        drawCtx.drawImage(croppedDraw, 0, 0);

        // Update display buffer
        displayCanvas.width = size; displayCanvas.height = size;

        // 5. Update the "Original" baseline for Revert
        const resizedImg = new Image();
        resizedImg.onload = () => {
            originalImg = resizedImg;

            // 6. Reset view and UI
            resetView();
            updateResizeInputs();
            validationErrors = [];
            validationStats = null;
            setDirty(true);
            render();

            console.log(`Cropped to ${size}x${size} square (Offset X:${offsetX}, Y:${offsetY})`);
        };
        resizedImg.src = bgCanvas.toDataURL();
    }
});
